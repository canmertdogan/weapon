import {
  createCPUState,
  execute,
  GP_REGISTERS,
  readRegister,
  type CPUState,
  type FlagName,
} from '../../utils/asm';

export interface InstructionPlaygroundOptions {
  initialCode?: string;
  title?: string;
}

const DEFAULT_CODE = `mov rax, 5
add rax, 3
sub rax, 1
cmp rax, 7
mov rbx, rax`;

export class InstructionPlayground {
  private container: HTMLElement;
  private title: string;
  private state: CPUState;
  private executedLines: string[];
  private lastChanged: Set<string>;
  private lastChangedFlags: Set<FlagName>;
  private lastCode: string;

  constructor(container: HTMLElement, options: InstructionPlaygroundOptions = {}) {
    this.container = container;
    this.title = options.title || 'Instruction Playground';
    this.state = this.freshState();
    this.executedLines = [];
    this.lastChanged = new Set();
    this.lastChangedFlags = new Set();
    this.lastCode = options.initialCode || DEFAULT_CODE;
    this.render(this.lastCode);
  }

  private freshState(): CPUState {
    const s = createCPUState(4096, 0x10000);
    s.regs.rsp = 0x7ffffff0n;
    return s;
  }

  private render(code: string): void {
    const regsHtml = GP_REGISTERS.map((r) => this.renderRegister(r)).join('');
    const flagsHtml = this.renderFlags();

    this.container.innerHTML = `
      <div class="playground" role="region" aria-label="${this.title}" tabindex="0"
           style="font-family: var(--font-mono); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
        <div class="pg-toolbar" style="display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-sm) var(--spacing-md); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: var(--spacing-sm);">
          <span style="color: var(--color-fg-muted); font-size: 0.75rem; letter-spacing: 0.05em;">${this.title.toUpperCase()}</span>
          <div class="pg-controls" style="display: flex; gap: var(--spacing-sm);">
            <button class="btn btn-secondary pg-reset" aria-label="Reset registers and flags to initial state" style="padding: 4px 12px; font-size: 0.75rem;">Reset</button>
            <button class="btn btn-primary pg-run" aria-label="Execute all instructions in the editor" style="padding: 4px 12px; font-size: 0.75rem;">Run</button>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0;">
          <div class="pg-editor-panel" style="border-right: 1px solid var(--color-border);">
            <div style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border);">CODE — One instruction per line</div>
            <textarea class="pg-code" spellcheck="false" aria-label="Assembly code input" role="textbox"
                      style="width: 100%; height: 220px; background: transparent; border: none; color: var(--color-fg); padding: var(--spacing-sm) var(--spacing-md); resize: vertical; font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.6; outline: none;">${this.escapeHtml(code)}</textarea>
          </div>
          <div class="pg-output-panel">
            <div style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border);">REGISTERS</div>
            <div role="list" aria-label="General purpose registers" style="padding: var(--spacing-sm); max-height: 220px; overflow: auto;">${regsHtml}</div>
          </div>
        </div>
        <div class="pg-flags-panel" style="border-top: 1px solid var(--color-border); padding: var(--spacing-sm) var(--spacing-md);">
          <div role="list" aria-label="CPU flags" style="display: flex; flex-wrap: wrap; gap: 4px;">
            <div style="color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; margin-bottom: var(--spacing-xs); width: 100%;">FLAGS</div>
            ${flagsHtml}
          </div>
        </div>
        <div class="pg-error" role="alert" aria-live="assertive"
             style="display: none; padding: var(--spacing-sm) var(--spacing-md); color: var(--color-danger); border-top: 1px solid var(--color-border); font-size: 0.8125rem;"></div>
        <div class="pg-status" aria-live="polite" aria-atomic="true"
             style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-accent); font-size: 0.75rem; border-top: 1px solid var(--color-border); min-height: 1.5em;">
          ${this.getStatusText()}
        </div>
      </div>
    `;

    this.attachEvents();
    this.restoreFocus();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#039;');
  }

  private getStatusText(): string {
    const lineCount = this.lastCode.split('\n').filter(l => l.trim()).length;
    return `Ready. ${lineCount} instruction${lineCount !== 1 ? 's' : ''} in editor. Press Run or Ctrl+Enter to execute.`;
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
    const runBtn = this.container.querySelector('.pg-run') as HTMLButtonElement;
    const resetBtn = this.container.querySelector('.pg-reset') as HTMLButtonElement;
    const codeEl = this.container.querySelector('.pg-code') as HTMLTextAreaElement;
    const errorEl = this.container.querySelector('.pg-error') as HTMLElement;
    const root = this.container.querySelector('.playground') as HTMLElement;

    runBtn?.addEventListener('click', () => this.runCode(codeEl, errorEl));
    resetBtn?.addEventListener('click', () => this.reset(codeEl));

    codeEl?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.runCode(codeEl, errorEl);
      }
    });

    root?.addEventListener('keydown', (e) => this.handleRootKeyDown(e));
    root?.addEventListener('focusin', () => this.updateFocusStyles(true));
    root?.addEventListener('focusout', () => this.updateFocusStyles(false));
  }

  private handleRootKeyDown(e: KeyboardEvent): void {
    if (e.key === 'r' || e.key === 'R') {
      if (!(e.target as HTMLElement).closest('textarea')) {
        e.preventDefault();
        this.reset(this.container.querySelector('.pg-code') as HTMLTextAreaElement);
      }
    }
  }

  private runCode(codeEl: HTMLTextAreaElement, errorEl: HTMLElement): void {
    this.lastCode = codeEl.value;
    this.state = this.freshState();
    this.lastChanged = new Set();
    this.lastChangedFlags = new Set();
    this.executedLines = [];
    const code = codeEl.value;
    const lines = code.split('\n').map((l) => l.trim()).filter(Boolean);
    let hasError = false;
    let errorLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        const result = execute(this.state, line);
        result.changedRegs.forEach((r) => this.lastChanged.add(r));
        result.changedFlags.forEach((f) => this.lastChangedFlags.add(f));
        this.executedLines.push(line);
      } catch (e) {
        errorEl.style.display = 'block';
        errorEl.textContent = `Error at line ${i + 1} ("${line}"): ${(e as Error).message}`;
        hasError = true;
        errorLine = i;
        break;
      }
    }

    if (!hasError) {
      errorEl.style.display = 'none';
    }

    this.render(this.lastCode);

    // Restore cursor position
    const newCodeEl = this.container.querySelector('.pg-code') as HTMLTextAreaElement;
    if (newCodeEl) {
      newCodeEl.focus();
      if (errorLine >= 0) {
        const lines = this.lastCode.split('\n');
        let charPos = 0;
        for (let i = 0; i < errorLine; i++) {
          charPos += lines[i].length + 1;
        }
        newCodeEl.setSelectionRange(charPos, charPos);
      }
    }

    this.announceResult(hasError, lines.length);
  }

  private reset(codeEl: HTMLTextAreaElement): void {
    this.state = this.freshState();
    this.lastChanged = new Set();
    this.lastChangedFlags = new Set();
    this.executedLines = [];
    this.render(codeEl.value);
    const statusEl = this.container.querySelector('.pg-status');
    if (statusEl) statusEl.textContent = this.getStatusText();
  }

  private announceResult(hasError: boolean, totalLines: number): void {
    const statusEl = this.container.querySelector('.pg-status');
    if (statusEl) {
      if (hasError) {
        statusEl.textContent = 'Execution stopped due to error. Check error panel.';
      } else {
        statusEl.textContent = `Executed ${totalLines} instruction${totalLines !== 1 ? 's' : ''} successfully.`;
      }
    }
  }

  private restoreFocus(): void {
    const codeEl = this.container.querySelector('.pg-code') as HTMLTextAreaElement;
    codeEl?.focus();
  }

  private updateFocusStyles(hasFocus: boolean): void {
    const root = this.container.querySelector('.playground') as HTMLElement;
    if (root) {
      root.style.borderColor = hasFocus ? 'var(--color-accent)' : 'var(--color-border)';
      root.style.boxShadow = hasFocus ? 'var(--shadow-glow-sm)' : 'none';
    }
  }
}