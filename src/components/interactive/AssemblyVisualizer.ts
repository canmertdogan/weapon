import {
  createCPUState,
  execute,
  GP_REGISTERS,
  readRegister,
  type CPUState,
  type FlagName,
} from '../../utils/asm';
import { getSessionState, saveSessionState } from '../../utils/storage';

export interface AssemblyVisualizerOptions {
  instructions: string[];
  title?: string;
  initialRegisters?: Partial<Record<string, bigint>>;
  initialFlags?: Partial<Record<string, boolean>>;
  lessonId?: string;
}

interface SavedAssemblyState {
  stepIndex: number;
  regs: Record<string, string>;
  flags: Record<string, boolean>;
}

export class AssemblyVisualizer {
  private container: HTMLElement;
  private instructions: string[];
  private title: string;
  private state: CPUState;
  private stepIndex: number;
  private lastChanged: Set<string>;
  private lastChangedFlags: Set<FlagName>;
  private focusedElement: 'step' | 'reset' | 'registers' | 'flags' | 'instructions' = 'step';
  private lessonId: string;
  private storageKey: string;

  constructor(container: HTMLElement, options: AssemblyVisualizerOptions) {
    this.container = container;
    this.instructions = options.instructions;
    this.title = options.title || 'Register State Machine';
    this.lessonId = options.lessonId || 'unknown';
    this.storageKey = `weapon:asm:${this.lessonId}`;
    this.state = createCPUState(4096, 0x10000);
    this.state.regs.rsp = 0x7ffffff0n;

    // Try to restore from sessionStorage
    const saved = getSessionState<SavedAssemblyState>(this.storageKey);
    if (saved) {
      this.stepIndex = saved.stepIndex;
      Object.entries(saved.regs).forEach(([reg, val]) => {
        try {
          (this.state.regs as Record<string, bigint>)[reg.toLowerCase()] = BigInt(val);
        } catch {}
      });
      Object.entries(saved.flags).forEach(([flag, val]) => {
        if (flag in this.state.flags) {
          (this.state.flags as unknown as Record<string, boolean>)[flag] = val;
        }
      });
    } else {
      this.stepIndex = -1;
    }

    if (options.initialRegisters) {
      Object.entries(options.initialRegisters).forEach(([reg, val]) => {
        try {
          (this.state.regs as Record<string, bigint>)[reg.toLowerCase()] = val!;
        } catch {}
      });
    }
    if (options.initialFlags) {
      Object.entries(options.initialFlags).forEach(([flag, val]) => {
        if (flag in this.state.flags) {
          (this.state.flags as unknown as Record<string, boolean>)[flag] = val!;
        }
      });
    }

    this.lastChanged = new Set();
    this.lastChangedFlags = new Set();
    this.render();
  }

  private render(): void {
    const regsHtml = GP_REGISTERS.map((r) => this.renderRegister(r)).join('');
    const flagsHtml = this.renderFlags();

    this.container.innerHTML = `
      <div class="asm-visualizer" role="region" aria-label="${this.title}" tabindex="0"
           style="font-family: var(--font-mono); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
        <div class="asm-toolbar" style="display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-sm) var(--spacing-md); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: var(--spacing-sm);">
          <span style="color: var(--color-fg-muted); font-size: 0.75rem; letter-spacing: 0.05em;">${this.title.toUpperCase()}</span>
          <div class="asm-controls" style="display: flex; gap: var(--spacing-sm);">
            <button class="btn btn-secondary asm-reset" aria-label="Reset simulation to initial state" style="padding: 4px 12px; font-size: 0.75rem;">Reset</button>
            <button class="btn btn-primary asm-step" aria-label="${this.stepIndex >= this.instructions.length - 1 ? 'Restart simulation' : 'Execute next instruction'}" style="padding: 4px 12px; font-size: 0.75rem;">${this.stepIndex >= this.instructions.length - 1 ? 'Restart' : 'Step'}</button>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 240px; gap: 0;">
          <div class="asm-registers-panel" role="region" aria-label="Registers" tabindex="0"
               style="outline: none; border-right: 1px solid var(--color-border);">
            <div style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border);">REGISTERS</div>
            <div role="list" aria-label="General purpose registers" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; padding: var(--spacing-sm);">
              ${regsHtml}
            </div>
          </div>
          <div class="asm-side-panel" style="border-left: 1px solid var(--color-border);">
            <div class="asm-flags-panel" role="region" aria-label="CPU Flags" tabindex="0"
                 style="outline: none; padding: var(--spacing-sm);">
              <div style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border);">FLAGS</div>
              <div role="list" aria-label="Flag register" style="display: flex; flex-wrap: wrap; gap: 4px;">${flagsHtml}</div>
            </div>
            <div class="asm-instructions-panel" role="region" aria-label="Instruction history" tabindex="0"
                 style="outline: none; padding: var(--spacing-sm);">
              <div style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border);">INSTRUCTION HISTORY</div>
              <div role="list" aria-label="Executed instructions" class="asm-current" style="max-height: 200px; overflow: auto;">${this.currentInstructionHtml()}</div>
            </div>
          </div>
        </div>
        <div class="asm-status" aria-live="polite" aria-atomic="true"
             style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-accent); font-size: 0.75rem; border-top: 1px solid var(--color-border); min-height: 1.5em;">
          ${this.getStatusText()}
        </div>
      </div>
    `;

    this.attachEvents();
    this.restoreFocus();
  }

  private getStatusText(): string {
    if (this.stepIndex < 0) {
      return 'Press Enter or click Step to begin. Use arrow keys to navigate panels.';
    }
    if (this.stepIndex >= this.instructions.length) {
      return 'Simulation complete. Press Reset to start over.';
    }
    return `Step ${this.stepIndex + 1} of ${this.instructions.length}: ${this.instructions[this.stepIndex]}`;
  }

  private renderRegister(r: string): string {
    const value = readRegister(this.state, r);
    const changed = this.lastChanged.has(r);
    const style = changed
      ? 'background: var(--color-accent); color: var(--color-bg);'
      : '';
    return `<div role="listitem" style="display: flex; justify-content: space-between; padding: 2px 8px; border-radius: 4px; transition: background 150ms; ${style}">
      <span style="color: ${changed ? 'var(--color-bg)' : 'var(--color-fg-muted)'}; font-weight: 600;">${r.toUpperCase()}</span>
      <span aria-label="${r.toUpperCase()} = 0x${value.toString(16).toUpperCase().padStart(16, '0')}">0x${value.toString(16).toUpperCase().padStart(16, '0')}</span>
    </div>`;
  }

  private renderFlags(): string {
    const flagNames: FlagName[] = ['CF', 'PF', 'AF', 'ZF', 'SF', 'TF', 'IF', 'DF', 'OF'];
    return flagNames
      .map((f) => {
        const set = this.state.flags[f];
        const changed = this.lastChangedFlags.has(f);
        const color = set ? 'var(--color-accent)' : 'var(--color-fg-muted)';
        return `<span role="listitem" style="display: inline-flex; margin: 2px; padding: 2px 6px; border-radius: 4px; border: 1px solid ${changed ? 'var(--color-accent)' : 'var(--color-border)'}; font-size: 0.75rem;">
          <span style="color: var(--color-fg-muted); margin-right: 4px;">${f}</span>
          <span style="color: ${color}; font-weight: 600;" aria-label="${f} flag: ${set ? 'set' : 'clear'}">${set ? '1' : '0'}</span>
        </span>`;
      })
      .join('');
  }

  private currentInstructionHtml(): string {
    const items = this.instructions
      .map((instr, i) => {
        if (i === this.stepIndex) {
          return `<div role="listitem" aria-current="step" style="color: var(--color-accent); font-weight: 600; padding: 2px 0;">➤ ${instr}</div>`;
        }
        if (i < this.stepIndex) {
          return `<div role="listitem" style="color: var(--color-fg-muted); padding: 2px 0;">${instr}</div>`;
        }
        return `<div role="listitem" style="color: var(--color-border); padding: 2px 0;">${instr}</div>`;
      })
      .join('');
    if (this.stepIndex < 0) {
      return `<div role="listitem" style="color: var(--color-fg-muted); font-style: italic; padding: 2px 0;">Click "Step" or press Enter to begin execution</div>${items}`;
    }
    return items;
  }

  private attachEvents(): void {
    const stepBtn = this.container.querySelector('.asm-step') as HTMLButtonElement;
    const resetBtn = this.container.querySelector('.asm-reset') as HTMLButtonElement;
    const root = this.container.querySelector('.asm-visualizer') as HTMLElement;
    const registersPanel = this.container.querySelector('.asm-registers-panel') as HTMLElement;
    const flagsPanel = this.container.querySelector('.asm-flags-panel') as HTMLElement;
    const instructionsPanel = this.container.querySelector('.asm-instructions-panel') as HTMLElement;

    stepBtn?.addEventListener('click', () => {
      if (this.stepIndex >= this.instructions.length - 1) {
        this.reset();
        return;
      }
      this.step();
    });

    resetBtn?.addEventListener('click', () => {
      this.reset();
    });

    root?.addEventListener('keydown', (e) => this.handleRootKeyDown(e));
    registersPanel?.addEventListener('keydown', (e) => this.handlePanelKeyDown(e, 'registers'));
    flagsPanel?.addEventListener('keydown', (e) => this.handlePanelKeyDown(e, 'flags'));
    instructionsPanel?.addEventListener('keydown', (e) => this.handlePanelKeyDown(e, 'instructions'));

    [stepBtn, resetBtn, registersPanel, flagsPanel, instructionsPanel].forEach((el) => {
      el?.addEventListener('focus', () => this.updateFocusStyles(el));
    });
  }

  private handleRootKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.target as HTMLElement).classList?.contains('asm-visualizer')) {
      e.preventDefault();
      if (this.stepIndex >= this.instructions.length - 1) {
        this.reset();
      } else {
        this.step();
      }
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      this.reset();
    } else if (e.key === 'Tab') {
      // Let natural tab order work
    }
  }

  private handlePanelKeyDown(e: KeyboardEvent, panel: 'registers' | 'flags' | 'instructions'): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = this.container.querySelectorAll(`.asm-${panel}-panel [role="listitem"], .asm-${panel}-panel [role="listitem"]`);
      const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);
      if (currentIndex >= 0) {
        const nextIndex = e.key === 'ArrowDown' ? Math.min(items.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
        (items[nextIndex] as HTMLElement)?.focus();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = this.container.querySelector(`.asm-${panel}-panel [role="listitem"]`) as HTMLElement;
      first?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const items = this.container.querySelectorAll(`.asm-${panel}-panel [role="listitem"]`);
      (items[items.length - 1] as HTMLElement)?.focus();
    }
  }

  private updateFocusStyles(el: HTMLElement | null): void {
    const root = this.container.querySelector('.asm-visualizer') as HTMLElement;
    if (!root || !el) return;

    root.style.borderColor = 'var(--color-accent)';
    root.style.boxShadow = 'var(--shadow-glow-sm)';

    // Track which panel has focus
    if (el.classList.contains('asm-registers-panel')) this.focusedElement = 'registers';
    else if (el.classList.contains('asm-flags-panel')) this.focusedElement = 'flags';
    else if (el.classList.contains('asm-instructions-panel')) this.focusedElement = 'instructions';
    else if (el.classList.contains('asm-step')) this.focusedElement = 'step';
    else if (el.classList.contains('asm-reset')) this.focusedElement = 'reset';
  }

  private restoreFocus(): void {
    const selectorMap: Record<string, string> = {
      step: '.asm-step',
      reset: '.asm-reset',
      registers: '.asm-registers-panel',
      flags: '.asm-flags-panel',
      instructions: '.asm-instructions-panel',
    };
    const selector = selectorMap[this.focusedElement];
    const el = this.container.querySelector(selector) as HTMLElement;
    el?.focus();
  }

  private saveState(): void {
    const regs: Record<string, string> = {};
    const flags: Record<string, boolean> = {};
    GP_REGISTERS.forEach((r) => {
      regs[r] = readRegister(this.state, r).toString();
    });
    ['CF', 'PF', 'AF', 'ZF', 'SF', 'TF', 'IF', 'DF', 'OF'].forEach((f) => {
      flags[f] = this.state.flags[f as FlagName];
    });
    saveSessionState(this.storageKey, { stepIndex: this.stepIndex, regs, flags });
  }

  private step(): void {
    this.stepIndex++;
    this.lastChanged = new Set();
    this.lastChangedFlags = new Set();
    const instr = this.instructions[this.stepIndex];
    try {
      const result = execute(this.state, instr);
      result.changedRegs.forEach((r) => this.lastChanged.add(r));
      result.changedFlags.forEach((f) => this.lastChangedFlags.add(f));
    } catch (e) {
      console.warn(`Step ${this.stepIndex} failed:`, e);
    }
    this.saveState();
    this.render();
    this.announceStep();
  }

  private announceStep(): void {
    const statusEl = this.container.querySelector('.asm-status');
    if (statusEl) {
      statusEl.textContent = this.getStatusText();
    }
  }

  private reset(): void {
    this.state = createCPUState(4096, 0x10000);
    this.state.regs.rsp = 0x7ffffff0n;
    this.stepIndex = -1;
    this.lastChanged = new Set();
    this.lastChangedFlags = new Set();
    this.saveState();
    this.render();
    const statusEl = this.container.querySelector('.asm-status');
    if (statusEl) statusEl.textContent = this.getStatusText();
  }
}