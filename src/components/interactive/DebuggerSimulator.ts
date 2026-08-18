import {
  createCPUState,
  execute,
  tokenize,
  GP_REGISTERS,
  readRegister,
  type CPUState,
  type FlagName,
} from '../../utils/asm';
import { getSessionState, saveSessionState } from '../../utils/storage';

export interface DebuggerSimulatorOptions {
  code: { address: number; op: string; args: string[] }[];
  labels?: Record<string, number>;
  title?: string;
  lessonId?: string;
}

interface SavedDebuggerState {
  pcIndex: number;
  regs: Record<string, string>;
  flags: Record<string, boolean>;
  breakpoints: number[];
  done: boolean;
}

const JCC_OPS = new Set([
  'je', 'jz', 'jne', 'jnz', 'ja', 'jnbe', 'jae', 'jnb',
  'jb', 'jnae', 'jbe', 'jna', 'jg', 'jnle', 'jge', 'jnl', 'jl', 'jnge', 'jle', 'jng',
]);

export class DebuggerSimulator {
  private container: HTMLElement;
  private code: { address: number; op: string; args: string[] }[];
  private labels: Record<string, number>;
  private title: string;
  private state: CPUState;
  private pcIndex: number;
  private breakpoints: Set<number>;
  private done: boolean;
  private lastChanged: Set<string>;
  private lastChangedFlags: Set<FlagName>;
  private lessonId: string;
  private storageKey: string;

  constructor(container: HTMLElement, options: DebuggerSimulatorOptions) {
    this.container = container;
    this.code = options.code;
    this.labels = options.labels || {};
    this.title = options.title || 'Debugger Simulator';
    this.lessonId = options.lessonId || 'unknown';
    this.storageKey = `weapon:dbg:${this.lessonId}`;

    // Try to restore from sessionStorage
    const saved = getSessionState<SavedDebuggerState>(this.storageKey);
    this.state = createCPUState(4096, 0x10000);
    this.state.regs.rsp = 0x7ffffff0n;

    if (saved) {
      this.pcIndex = saved.pcIndex;
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
      this.breakpoints = new Set(saved.breakpoints);
      this.done = saved.done;
    } else {
      this.pcIndex = 0;
      this.breakpoints = new Set();
      this.done = false;
    }
    this.lastChanged = new Set();
    this.lastChangedFlags = new Set();
    this.render();
  }

  private currentAddress(): number {
    return this.code[this.pcIndex]?.address ?? -1;
  }

  private indexOfAddress(addr: number): number {
    const idx = this.code.findIndex((c) => c.address === addr);
    return idx >= 0 ? idx : this.code.length;
  }

  private resolveTarget(arg: string): number {
    const a = (arg || '').toLowerCase();
    if (a in this.labels) return this.labels[a];
    if (a.startsWith('0x')) return Number.parseInt(a.slice(2), 16);
    if (/^\d+$/.test(a)) return Number.parseInt(a, 10);
    return this.pcIndex + 1;
  }

  private reset(): void {
    this.state = createCPUState(4096, 0x10000);
    this.state.regs.rsp = 0x7ffffff0n;
    this.pcIndex = 0;
    this.done = false;
    this.breakpoints.clear();
    this.lastChanged = new Set();
    this.lastChangedFlags = new Set();
    this.saveState();
    this.render();
  }

  private step(): void {
    if (this.done || this.pcIndex >= this.code.length) {
      this.done = true;
      this.render();
      return;
    }
    const instr = this.code[this.pcIndex];
    const line = `${instr.op} ${instr.args.join(', ')}`.trim();
    const dec = tokenize(line);
    if (!dec) {
      this.pcIndex++;
      this.render();
      return;
    }

    this.lastChanged = new Set();
    this.lastChangedFlags = new Set();

    if (dec.op === 'ret') {
      this.done = true;
    } else if (dec.op === 'jmp') {
      this.pcIndex = this.indexOfAddress(this.resolveTarget(dec.operands[0] || ''));
    } else if (JCC_OPS.has(dec.op)) {
      const result = execute(this.state, line);
      result.changedFlags.forEach((f) => this.lastChangedFlags.add(f));
      if (result.taken) {
        this.pcIndex = this.indexOfAddress(this.resolveTarget(dec.operands[0] || ''));
      } else {
        this.pcIndex++;
      }
    } else {
      const result = execute(this.state, line);
      result.changedRegs.forEach((r) => this.lastChanged.add(r));
      result.changedFlags.forEach((f) => this.lastChangedFlags.add(f));
      this.pcIndex++;
    }

    if (this.pcIndex >= this.code.length) this.done = true;
    this.saveState();
    this.render();
    this.announceStep();
  }

  private run(): void {
    let guard = 0;
    while (!this.done && guard < 1000) {
      const addr = this.currentAddress();
      if (this.breakpoints.has(addr)) break;
      this.step();
      guard++;
    }
    this.saveState();
    this.render();
    this.announceRun();
  }

  private toggleBreakpoint(address: number): void {
    if (this.breakpoints.has(address)) this.breakpoints.delete(address);
    else this.breakpoints.add(address);
    this.saveState();
    this.render();
  }

  private render(): void {
    const listing = this.code
      .map((instr, i) => {
        const isCurrent = i === this.pcIndex && !this.done;
        const hasBp = this.breakpoints.has(instr.address);
        const text = `${instr.op} ${instr.args.join(', ')}`;
        return `<div role="button" tabindex="0" data-addr="${instr.address}" class="dbg-line"
              style="display: flex; align-items: center; gap: 8px; padding: 2px 8px; cursor: pointer; border-radius: 4px; ${isCurrent ? 'background: var(--color-accent);' : ''}"
              aria-label="${hasBp ? 'Breakpoint set' : 'No breakpoint'} at 0x${instr.address.toString(16).padStart(2, '0')}: ${text}"
              aria-pressed="${hasBp}" ${isCurrent ? 'aria-current="step"' : ''}>
            <span style="width: 14px; text-align: center; flex-shrink: 0; color: ${hasBp ? 'var(--color-accent)' : 'transparent'};">${hasBp ? '●' : ''}</span>
            <span style="width: 40px; color: ${isCurrent ? 'var(--color-bg)' : 'var(--color-fg-muted)'}; flex-shrink: 0;">${'0x' + instr.address.toString(16).padStart(2, '0')}</span>
            <span style="color: ${isCurrent ? 'var(--color-bg)' : 'var(--color-fg)'}; font-weight: ${isCurrent ? 600 : 400};">${text}</span>
          </div>`;
      })
      .join('');

    const regsHtml = GP_REGISTERS
      .map((r) => this.renderRegister(r))
      .join('');

    const flagsHtml = this.renderFlags();

    this.container.innerHTML = `
      <style>
        @media (max-width: 640px) {
          .dbg-simulator .dbg-columns { grid-template-columns: 1fr !important; }
          .dbg-simulator .dbg-disasm-panel { border-right: none !important; border-bottom: 1px solid var(--color-border); }
          .dbg-simulator .dbg-side-panel { border-left: none !important; }
        }
      </style>
      <div class="dbg-simulator" role="region" aria-label="${this.title}" tabindex="0"
           style="font-family: var(--font-mono); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
        <div class="dbg-toolbar" style="display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-sm) var(--spacing-md); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: var(--spacing-sm);">
          <span style="color: var(--color-fg-muted); font-size: 0.75rem; letter-spacing: 0.05em;">${this.title.toUpperCase()}</span>
          <div class="dbg-controls" style="display: flex; gap: var(--spacing-sm);">
            <button class="btn btn-secondary dbg-reset" aria-label="Reset simulation to initial state" style="padding: 4px 10px; font-size: 0.75rem;">Reset</button>
            <button class="btn btn-secondary dbg-clear" aria-label="Clear all breakpoints" style="padding: 4px 10px; font-size: 0.75rem;">Clear BP</button>
            <button class="btn btn-secondary dbg-step" aria-label="Execute single instruction" style="padding: 4px 10px; font-size: 0.75rem;">Step</button>
            <button class="btn btn-primary dbg-run" aria-label="Run until breakpoint or program end" style="padding: 4px 10px; font-size: 0.75rem;">Run</button>
          </div>
        </div>
        <div class="dbg-columns" style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 0;">
          <div class="dbg-disasm-panel" role="region" aria-label="Disassembly" tabindex="0" style="outline: none; border-right: 1px solid var(--color-border);">
            <div style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border);">DISASSEMBLY — Enter/Space to toggle breakpoint, Arrow keys to navigate</div>
            <div role="list" aria-label="Instructions" style="padding: var(--spacing-sm); font-size: 0.8125rem; max-height: 360px; overflow: auto;">${listing}</div>
          </div>
          <div class="dbg-side-panel" style="border-left: 1px solid var(--color-border);">
            <div class="dbg-registers-panel" role="region" aria-label="Registers" tabindex="0" style="outline: none; padding: var(--spacing-sm);">
              <div style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border);">REGISTERS</div>
              <div role="list" aria-label="General purpose registers" style="max-height: 200px; overflow: auto;">${regsHtml}</div>
            </div>
            <div class="dbg-flags-panel" role="region" aria-label="Flags" tabindex="0" style="outline: none; padding: var(--spacing-sm);">
              <div style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border);">FLAGS</div>
              <div role="list" aria-label="CPU flags" style="display: flex; flex-wrap: wrap; gap: 4px;">${flagsHtml}</div>
            </div>
            <div class="dbg-status" role="status" aria-live="polite" aria-atomic="true"
                 style="padding: var(--spacing-sm); color: ${this.done ? 'var(--color-warn)' : 'var(--color-fg-muted)'}; font-size: 0.8125rem; border-top: 1px solid var(--color-border); min-height: 1.5em;">
              ${this.done ? 'Program terminated (ret)' : 'Ready — press Step or Run'}
            </div>
          </div>
        </div>
      </div>
    `;
    this.attachEvents();
    this.restoreFocus();
  }

  private renderRegister(r: string): string {
    const value = readRegister(this.state, r);
    const changed = this.lastChanged.has(r);
    const style = changed ? 'background: var(--color-accent); color: var(--color-bg);' : '';
    return `<div role="listitem" style="display: flex; justify-content: space-between; padding: 2px 8px; border-radius: 4px; ${style}">
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

  private attachEvents(): void {
    const stepBtn = this.container.querySelector('.dbg-step') as HTMLButtonElement;
    const runBtn = this.container.querySelector('.dbg-run') as HTMLButtonElement;
    const resetBtn = this.container.querySelector('.dbg-reset') as HTMLButtonElement;
    const clearBtn = this.container.querySelector('.dbg-clear') as HTMLButtonElement;
    const disasmPanel = this.container.querySelector('.dbg-disasm-panel') as HTMLElement;
    const registersPanel = this.container.querySelector('.dbg-registers-panel') as HTMLElement;
    const flagsPanel = this.container.querySelector('.dbg-flags-panel') as HTMLElement;
    const root = this.container.querySelector('.dbg-simulator') as HTMLElement;

    stepBtn?.addEventListener('click', () => this.step());
    runBtn?.addEventListener('click', () => this.run());
    resetBtn?.addEventListener('click', () => this.reset());
    clearBtn?.addEventListener('click', () => {
      this.breakpoints.clear();
      this.render();
    });

    this.container.querySelectorAll('.dbg-line').forEach((el) => {
      el.addEventListener('click', () => {
        const addr = Number((el as HTMLElement).dataset.addr);
        this.toggleBreakpoint(addr);
      });
      el.addEventListener('keydown', (e) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          const addr = Number((el as HTMLElement).dataset.addr);
          this.toggleBreakpoint(addr);
        }
      });
    });

    disasmPanel?.addEventListener('keydown', (e) => this.handleDisasmKeyDown(e));
    registersPanel?.addEventListener('keydown', (e) => this.handlePanelKeyDown(e, 'registers'));
    flagsPanel?.addEventListener('keydown', (e) => this.handlePanelKeyDown(e, 'flags'));

    root?.addEventListener('keydown', (e) => this.handleRootKeyDown(e));
    root?.addEventListener('focusin', () => this.updateFocusStyles(true));
    root?.addEventListener('focusout', () => this.updateFocusStyles(false));

    [stepBtn, runBtn, resetBtn, clearBtn, disasmPanel, registersPanel, flagsPanel].forEach((el) => {
      el?.addEventListener('focus', () => this.updateFocusStyles(true));
    });
  }

  private handleRootKeyDown(e: KeyboardEvent): void {
    if (e.key === 'F5' || (e.key === 'r' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      this.run();
    } else if (e.key === 'F10' || e.key === 'F11') {
      e.preventDefault();
      this.step();
    } else if (e.key === 'F9') {
      e.preventDefault();
      const currentLine = this.container.querySelector('.dbg-line[aria-current="step"]') as HTMLElement;
      if (currentLine) {
        const addr = Number(currentLine.dataset.addr);
        this.toggleBreakpoint(addr);
      }
    }
  }

  private handleDisasmKeyDown(e: KeyboardEvent): void {
    const lines = this.container.querySelectorAll('.dbg-line');
    if (lines.length === 0) return;

    const currentIndex = Array.from(lines).findIndex((el) => el === document.activeElement || el.getAttribute('aria-current') === 'step');
    const focusIndex = currentIndex >= 0 ? currentIndex : 0;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(lines.length - 1, focusIndex + 1);
      (lines[nextIndex] as HTMLElement).focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(0, focusIndex - 1);
      (lines[prevIndex] as HTMLElement).focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      (lines[0] as HTMLElement).focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      (lines[lines.length - 1] as HTMLElement).focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const target = document.activeElement as HTMLElement;
      if (target.classList.contains('dbg-line')) {
        const addr = Number(target.dataset.addr);
        this.toggleBreakpoint(addr);
      }
    }
  }

  private handlePanelKeyDown(e: KeyboardEvent, panel: 'registers' | 'flags'): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = this.container.querySelectorAll(`.dbg-${panel}-panel [role="listitem"]`);
      const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);
      if (currentIndex >= 0) {
        const nextIndex = e.key === 'ArrowDown' ? Math.min(items.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
        (items[nextIndex] as HTMLElement)?.focus();
      }
    }
  }

  private restoreFocus(): void {
    const currentLine = this.container.querySelector('.dbg-line[aria-current="step"]') as HTMLElement;
    if (currentLine) {
      currentLine.focus();
    } else {
      const firstLine = this.container.querySelector('.dbg-line') as HTMLElement;
      firstLine?.focus();
    }
  }

  private announceStep(): void {
    const statusEl = this.container.querySelector('.dbg-status');
    if (statusEl) {
      if (this.done) {
        statusEl.textContent = 'Program terminated (ret)';
      } else {
        const instr = this.code[this.pcIndex];
        if (instr) {
          statusEl.textContent = `Stepped: ${instr.op} ${instr.args.join(', ')}`;
        }
      }
    }
  }

  private announceRun(): void {
    const statusEl = this.container.querySelector('.dbg-status');
    if (statusEl) {
      if (this.done) {
        statusEl.textContent = 'Program terminated (ret)';
      } else {
        const addr = this.currentAddress();
        if (this.breakpoints.has(addr)) {
          statusEl.textContent = `Breakpoint hit at 0x${addr.toString(16).padStart(2, '0')}`;
        } else {
          statusEl.textContent = 'Run completed';
        }
      }
    }
  }

  private updateFocusStyles(hasFocus: boolean): void {
    const root = this.container.querySelector('.dbg-simulator') as HTMLElement;
    if (root) {
      root.style.borderColor = hasFocus ? 'var(--color-accent)' : 'var(--color-border)';
      root.style.boxShadow = hasFocus ? 'var(--shadow-glow-sm)' : 'none';
    }
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
    saveSessionState(this.storageKey, {
      pcIndex: this.pcIndex,
      regs,
      flags,
      breakpoints: Array.from(this.breakpoints),
      done: this.done,
    });
  }
}