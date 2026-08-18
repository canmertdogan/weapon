import {
  createCPUState,
  readRegister,
  tokenize,
  type CPUState,
} from '../../utils/asm';
import { getSessionState, saveSessionState } from '../../utils/storage';

export interface StackVisualizerOptions {
  instructions: string[];
  title?: string;
  initialStack?: { address: number; value: bigint; label?: string }[];
  lessonId?: string;
}

interface StackEntry {
  address: number;
  value: bigint;
  label: string;
  active: boolean;
}

interface SavedStackState {
  stepIndex: number;
  rsp: string;
  rbp: string;
  stack: Array<{ address: number; value: string; label: string; active: boolean }>;
}

export class StackVisualizer {
  private container: HTMLElement;
  private instructions: string[];
  private title: string;
  private state: CPUState;
  private stepIndex: number;
  private stack: StackEntry[];
  private initialStack: StackEntry[];
  private focusedIndex: number = -1;
  private lessonId: string;
  private storageKey: string;

  constructor(container: HTMLElement, options: StackVisualizerOptions) {
    this.container = container;
    this.instructions = options.instructions;
    this.title = options.title || 'Stack Frame Explorer';
    this.lessonId = options.lessonId || 'unknown';
    this.storageKey = `weapon:stack:${this.lessonId}`;
    this.state = createCPUState(4096, 0x10000);
    this.state.regs.rsp = 0x7ffffff0n;
    this.state.regs.rbp = 0x7ffffff0n;

    // Try to restore from sessionStorage
    const saved = getSessionState<SavedStackState>(this.storageKey);
    if (saved) {
      this.stepIndex = saved.stepIndex;
      this.state.regs.rsp = BigInt(saved.rsp);
      this.state.regs.rbp = BigInt(saved.rbp);
      this.stack = saved.stack.map(e => ({
        address: e.address,
        value: BigInt(e.value),
        label: e.label,
        active: e.active,
      }));
    } else {
      this.stepIndex = -1;
      this.stack = (options.initialStack || []).map((e) => ({
        address: e.address,
        value: e.value,
        label: e.label || '',
        active: false,
      }));
      if (this.stack.length === 0) {
        const base = 0x7ffffff0;
        this.stack = [
          { address: base + 0x30, value: 0x00401234n, label: '', active: false },
          { address: base + 0x28, value: 0x00000001n, label: '', active: false },
          { address: base + 0x20, value: 0x00000002n, label: '', active: false },
          { address: base + 0x18, value: 0x00401050n, label: 'return address', active: false },
          { address: base + 0x10, value: 0x7ffffff0n, label: 'saved RBP', active: false },
          { address: base + 0x08, value: 0xdeadbeefn, label: '', active: false },
          { address: base + 0x00, value: 0x00000000n, label: '', active: false },
        ].reverse();
      }
    }
    this.initialStack = this.stack.map((e) => ({ ...e }));
    this.render();
  }

  private render(): void {
    const stackHtml = this.renderStack();

    this.container.innerHTML = `
      <style>
        .stack-visualizer .stack-main-panel, .stack-visualizer .stack-side-panel { min-width: 0; }
        .stack-visualizer .stack-list { overflow-x: auto; }
        @media (max-width: 640px) {
          .stack-visualizer .stack-columns { grid-template-columns: 1fr !important; }
          .stack-visualizer .stack-main-panel { border-right: none !important; border-bottom: 1px solid var(--color-border); }
          .stack-visualizer .stack-side-panel { border-left: none !important; }
        }
      </style>
      <div class="stack-visualizer" role="region" aria-label="${this.title}" tabindex="0"
           style="font-family: var(--font-mono); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
        <div class="stack-toolbar" style="display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-sm) var(--spacing-md); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: var(--spacing-sm);">
          <span style="color: var(--color-fg-muted); font-size: 0.75rem; letter-spacing: 0.05em;">${this.title.toUpperCase()}</span>
          <div class="stack-controls" style="display: flex; gap: var(--spacing-sm);">
            <button class="btn btn-secondary stack-reset" aria-label="Reset stack to initial state" style="padding: 4px 12px; font-size: 0.75rem;">Reset</button>
            <button class="btn btn-primary stack-step" aria-label="${this.stepIndex >= this.instructions.length - 1 ? 'Restart simulation' : 'Execute next instruction'}" style="padding: 4px 12px; font-size: 0.75rem;">${this.stepIndex >= this.instructions.length - 1 ? 'Restart' : 'Step'}</button>
          </div>
        </div>
        <div class="stack-columns" style="display: grid; grid-template-columns: 1fr 260px; gap: 0;">
          <div class="stack-main-panel" role="region" aria-label="Stack memory" tabindex="0"
               style="outline: none; padding: var(--spacing-sm); border-right: 1px solid var(--color-border);">
            <div style="color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; margin-bottom: var(--spacing-sm);">STACK (grows downward → higher addresses at top)</div>
            <div role="list" aria-label="Stack frames" class="stack-list">${stackHtml}</div>
          </div>
          <div class="stack-side-panel" style="border-left: 1px solid var(--color-border); padding: var(--spacing-sm);">
            <div style="color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; margin-bottom: var(--spacing-sm);">REGISTERS</div>
            <div role="list" aria-label="Stack registers">
              <div role="listitem" style="display: flex; justify-content: space-between; padding: 2px 0;">
                <span style="color: var(--color-fg-muted);">RSP</span>
                <span aria-label="Stack pointer: 0x${this.state.regs.rsp.toString(16).toUpperCase().padStart(16, '0')}">0x${this.state.regs.rsp.toString(16).toUpperCase().padStart(16, '0')}</span>
              </div>
              <div role="listitem" style="display: flex; justify-content: space-between; padding: 2px 0;">
                <span style="color: var(--color-fg-muted);">RBP</span>
                <span aria-label="Base pointer: 0x${this.state.regs.rbp.toString(16).toUpperCase().padStart(16, '0')}">0x${this.state.regs.rbp.toString(16).toUpperCase().padStart(16, '0')}</span>
              </div>
            </div>
            <div style="color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; margin-top: var(--spacing-md); margin-bottom: var(--spacing-sm);">NEXT INSTRUCTION</div>
            <div class="stack-current" style="color: var(--color-accent); font-weight: 600; min-height: 1.5em;">${this.currentInstruction()}</div>
          </div>
        </div>
        <div class="stack-status" aria-live="polite" aria-atomic="true"
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
      return 'Press Enter or click Step to begin. Use arrow keys to navigate stack entries.';
    }
    if (this.stepIndex >= this.instructions.length) {
      return 'Simulation complete. Press Reset to start over.';
    }
    return `Step ${this.stepIndex + 1} of ${this.instructions.length}: ${this.instructions[this.stepIndex]}`;
  }

  private renderStack(): string {
    return this.stack
      .map((entry, index) => {
        const isRsp = entry.address === Number(this.state.regs.rsp);
        const isRbp = entry.address === Number(this.state.regs.rbp);
        const marker = isRsp ? 'RSP →' : isRbp ? 'RBP →' : '';
        const borderColor = entry.active ? 'var(--color-stack-active)' : 'var(--color-border)';
        const isFocused = this.focusedIndex === index;
        return `<div role="listitem" tabindex="${isFocused ? '0' : '-1'}" data-stack-index="${index}"
              style="display: flex; align-items: center; gap: var(--spacing-sm); padding: 4px 8px; border: 1px solid ${borderColor}; border-radius: 4px; margin-bottom: 4px; min-width: fit-content; ${entry.active ? 'background: var(--color-stack-active)11;' : ''} ${isFocused ? 'outline: 2px solid var(--color-accent); outline-offset: -2px;' : ''}"
              aria-selected="${isFocused}" aria-label="${marker || `Address 0x${entry.address.toString(16).toUpperCase().padStart(8, '0')}`}: value 0x${entry.value.toString(16).toUpperCase().padStart(16, '0')}${entry.label ? `, ${entry.label}` : ''}">
          <span style="min-width: 96px; flex-shrink: 0; white-space: nowrap; color: ${marker ? 'var(--color-stack-active)' : 'var(--color-fg-muted)'}; font-weight: ${marker ? 600 : 400}; font-family: var(--font-mono);">${marker || '0x' + entry.address.toString(16).toUpperCase().padStart(8, '0')}</span>
          <span style="flex-shrink: 0; font-family: var(--font-mono);">0x${entry.value.toString(16).toUpperCase().padStart(16, '0')}</span>
          ${entry.label ? `<span style="color: var(--color-fg-muted); font-size: 0.6875rem; white-space: nowrap;">${entry.label}</span>` : ''}
        </div>`;
      })
      .join('');
  }

  private currentInstruction(): string {
    if (this.stepIndex < 0) return 'Press "Step" or Enter to begin';
    if (this.stepIndex < this.instructions.length) {
      return `➤ ${this.instructions[this.stepIndex]}`;
    }
    return 'Complete — press Reset to restart';
  }

  private attachEvents(): void {
    const stepBtn = this.container.querySelector('.stack-step') as HTMLButtonElement;
    const resetBtn = this.container.querySelector('.stack-reset') as HTMLButtonElement;
    const root = this.container.querySelector('.stack-visualizer') as HTMLElement;
    const mainPanel = this.container.querySelector('.stack-main-panel') as HTMLElement;
    const stackList = this.container.querySelector('.stack-list') as HTMLElement;

    stepBtn?.addEventListener('click', () => {
      if (this.stepIndex >= this.instructions.length - 1) {
        this.reset();
        return;
      }
      this.step();
    });

    resetBtn?.addEventListener('click', () => this.reset());

    root?.addEventListener('keydown', (e) => this.handleRootKeyDown(e));
    mainPanel?.addEventListener('keydown', (e) => this.handlePanelKeyDown(e));
    stackList?.addEventListener('click', (e) => this.handleStackClick(e));

    [stepBtn, resetBtn, mainPanel].forEach((el) => {
      el?.addEventListener('focus', () => this.updateFocusStyles(el));
    });
  }

  private handleRootKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.target as HTMLElement).classList?.contains('stack-visualizer')) {
      e.preventDefault();
      if (this.stepIndex >= this.instructions.length - 1) {
        this.reset();
      } else {
        this.step();
      }
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      this.reset();
    }
  }

  private handlePanelKeyDown(e: KeyboardEvent): void {
    const items = this.container.querySelectorAll('.stack-list [role="listitem"]');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIndex = Math.min(items.length - 1, this.focusedIndex + 1);
      this.updateStackFocus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusedIndex = Math.max(0, this.focusedIndex - 1);
      this.updateStackFocus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.focusedIndex = 0;
      this.updateStackFocus();
    } else if (e.key === 'End') {
      e.preventDefault();
      this.focusedIndex = items.length - 1;
      this.updateStackFocus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Could add inspection detail here
    }
  }

  private handleStackClick(e: MouseEvent): void {
    const item = (e.target as HTMLElement).closest('[role="listitem"][data-stack-index]') as HTMLElement | null;
    if (!item) return;
    this.focusedIndex = parseInt(item.dataset.stackIndex || '0', 10);
    this.updateStackFocus();
    item.focus();
  }

  private updateStackFocus(): void {
    const items = this.container.querySelectorAll('.stack-list [role="listitem"]');
    items.forEach((item, i) => {
      const isFocused = i === this.focusedIndex;
      (item as HTMLElement).tabIndex = isFocused ? 0 : -1;
      (item as HTMLElement).style.outline = isFocused ? '2px solid var(--color-accent)' : 'none';
      (item as HTMLElement).style.outlineOffset = '-2px';
      item.setAttribute('aria-selected', String(isFocused));
    });
    const focusedItem = items[this.focusedIndex] as HTMLElement;
    focusedItem?.focus();
    focusedItem?.scrollIntoView({ block: 'nearest' });
  }

  private updateFocusStyles(el: HTMLElement | null): void {
    const root = this.container.querySelector('.stack-visualizer') as HTMLElement;
    if (!root || !el) return;

    root.style.borderColor = 'var(--color-accent)';
    root.style.boxShadow = 'var(--shadow-glow-sm)';
  }

  private restoreFocus(): void {
    const selectorMap: Record<string, string> = {
      step: '.stack-step',
      reset: '.stack-reset',
      main: '.stack-main-panel',
    };
    // Default to main panel
    const mainPanel = this.container.querySelector('.stack-main-panel') as HTMLElement;
    mainPanel?.focus();
    this.updateStackFocus();
  }

  private saveState(): void {
    saveSessionState(this.storageKey, {
      stepIndex: this.stepIndex,
      rsp: this.state.regs.rsp.toString(),
      rbp: this.state.regs.rbp.toString(),
      stack: this.stack.map(e => ({
        address: e.address,
        value: e.value.toString(),
        label: e.label,
        active: e.active,
      })),
    });
  }

  private step(): void {
    this.stepIndex++;
    const instr = this.instructions[this.stepIndex];
    const dec = tokenize(instr);
    if (!dec) return;

    this.stack.forEach((e) => (e.active = false));

    try {
      if (dec.op === 'push') {
        this.state.regs.rsp -= 8n;
        const addr = Number(this.state.regs.rsp);
        const value = this.readOperandValue(dec.operands[0]);
        this.stack.unshift({ address: addr, value, label: 'pushed', active: true });
      } else if (dec.op === 'pop') {
        const entry = this.stack.shift();
        if (entry) this.state.regs.rsp += 8n;
      } else if (dec.op === 'mov' && dec.operands[0] === 'rbp') {
        this.state.regs.rbp = this.state.regs.rsp;
      } else if (dec.op === 'mov' && dec.operands[0] === 'rsp') {
        this.state.regs.rsp = this.state.regs.rbp;
      } else if (dec.op === 'sub' && dec.operands[0] === 'rsp') {
        const amount = this.readOperandValue(dec.operands[1]);
        this.state.regs.rsp -= amount;
      } else if (dec.op === 'add' && dec.operands[0] === 'rsp') {
        const amount = this.readOperandValue(dec.operands[1]);
        this.state.regs.rsp += amount;
      } else if (dec.op === 'ret') {
        const entry = this.stack.shift();
        if (entry) this.state.regs.rsp += 8n;
      }
    } catch (e) {
      console.warn('Stack step failed:', e);
    }
    this.saveState();
    this.render();
    this.announceStep();
  }

  private announceStep(): void {
    const statusEl = this.container.querySelector('.stack-status');
    if (statusEl) {
      statusEl.textContent = this.getStatusText();
    }
    const currentEl = this.container.querySelector('.stack-current');
    if (currentEl) {
      currentEl.textContent = this.currentInstruction();
    }
  }

  private readOperandValue(operand: string): bigint {
    const alias = (operand || '').toLowerCase();
    if (alias.startsWith('0x') || /^\d+$/.test(alias)) {
      if (alias.startsWith('0x')) return BigInt(alias);
      return BigInt(alias);
    }
    try {
      return readRegister(this.state, alias);
    } catch {
      return 0n;
    }
  }

  private reset(): void {
    this.state = createCPUState(4096, 0x10000);
    this.state.regs.rsp = 0x7ffffff0n;
    this.state.regs.rbp = 0x7ffffff0n;
    this.stepIndex = -1;
    this.stack = this.initialStack.map((e) => ({ ...e }));
    this.focusedIndex = -1;
    this.saveState();
    this.render();
    const statusEl = this.container.querySelector('.stack-status');
    if (statusEl) statusEl.textContent = this.getStatusText();
  }
}