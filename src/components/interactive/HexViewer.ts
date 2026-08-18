import { buildHexRows, hexToBytes, toHex } from '../../utils/hex';

export interface HexViewerOptions {
  data: string;
  mode?: 'raw' | 'pe';
  highlightRanges?: { start: number; end: number; label: string; color: string }[];
}

export class HexViewer {
  private container: HTMLElement;
  private bytes: Uint8Array;
  private selectedOffset: number | null = null;
  private highlightRanges: { start: number; end: number; label: string; color: string }[];
  private focusedOffset: number = 0;
  private readonly rowsPerPage = 16;
  private readonly cols = 16;

  constructor(container: HTMLElement, options: HexViewerOptions) {
    this.container = container;
    this.bytes = hexToBytes(options.data);
    this.highlightRanges = options.highlightRanges || [];
    this.render();
  }

  private render(): void {
    const rows = buildHexRows(this.bytes, this.cols);
    const header = this.renderHeader();
    const body = rows.map((row) => this.renderRow(row)).join('');
    const legend = this.renderLegend();

    this.container.innerHTML = `
      <style>
        .hex-viewer { font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.7; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
        .hex-toolbar { display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-sm) var(--spacing-md); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: var(--spacing-sm); }
        .hex-toolbar-title { color: var(--color-fg-muted); font-size: 0.75rem; letter-spacing: 0.05em; }
        .hex-toolbar-actions { display: flex; gap: var(--spacing-xs); }
        .hex-body { max-height: 360px; overflow: auto; outline: none; }
        .hex-header { display: flex; padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border); position: sticky; top: 0; background: var(--color-bg); z-index: 1; }
        .hex-row { display: flex; align-items: baseline; padding: 0 var(--spacing-md); white-space: nowrap; }
        .hex-row:hover { background: var(--color-bg-elevated); }
        .hex-offset { width: 11ch; flex-shrink: 0; color: var(--color-fg-muted); }
        .hex-groups { display: flex; gap: 2.5ch; }
        .hex-group { display: inline-flex; }
        .hex-cell { display: inline-block; width: 2.1ch; text-align: center; margin: 0 0.5px; border-radius: 2px; cursor: pointer; }
        .hex-ascii { display: flex; align-items: baseline; gap: 2.5ch; margin-left: 2.5ch; }
        .hex-ascii-pipe { color: var(--color-fg-muted); opacity: 0.4; }
        .hex-ascii-cell { display: inline-block; width: 1ch; text-align: center; cursor: pointer; border-radius: 2px; color: var(--color-fg); }
        .hex-legend { padding: var(--spacing-sm) var(--spacing-md); border-top: 1px solid var(--color-border); display: flex; flex-wrap: wrap; }
        .hex-status { padding: var(--spacing-xs) var(--spacing-md); color: var(--color-accent); font-size: 0.75rem; border-top: 1px solid var(--color-border); min-height: 1.5em; }
      </style>
      <div class="hex-viewer" role="region" aria-label="Hex viewer" tabindex="0">
        <div class="hex-toolbar">
          <span class="hex-toolbar-title">HEX VIEWER</span>
          <span style="color: var(--color-fg-muted); font-size: 0.75rem;">${this.bytes.length} bytes</span>
          <div class="hex-toolbar-actions">
            <button class="hex-goto-btn btn btn-ghost" aria-label="Go to offset" style="padding: 2px 8px; font-size: 0.75rem;">Go to offset…</button>
            <button class="hex-search-btn btn btn-ghost" aria-label="Find bytes" style="padding: 2px 8px; font-size: 0.75rem;">Find…</button>
            <button class="hex-copy-btn btn btn-ghost" aria-label="Copy selection" style="padding: 2px 8px; font-size: 0.75rem;" disabled>Copy</button>
          </div>
        </div>
        ${header}
        <div class="hex-viewer-body hex-body" role="grid" aria-label="Hex data" tabindex="0">
          ${body}
        </div>
        ${legend}
        <div class="hex-viewer-status hex-status" aria-live="polite" aria-atomic="true">
          ${this.getStatusText()}
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private getStatusText(): string {
    if (this.selectedOffset === null) {
      return 'Use arrow keys to navigate. Press Enter to select. Press G to go to offset, F to find.';
    }
    const byte = this.bytes[this.selectedOffset];
    const range = this.highlightRanges.find((r) => this.selectedOffset! >= r.start && this.selectedOffset! < r.end);
    let status = `Offset: ${toHex(this.selectedOffset, 8)}  Byte: ${byte !== undefined ? '0x' + byte.toString(16).padStart(2, '0') : '—'}  ASCII: ${byte !== undefined ? (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.') : '—'}`;
    if (range) status += `  [${range.label}]`;
    return status;
  }

  private renderHeader(): string {
    return `<div class="hex-header" role="row">
      <span role="columnheader" class="hex-offset">OFFSET</span>
      <span role="columnheader" class="hex-groups" style="color: var(--color-fg-muted);">
        <span class="hex-group">00 01 02 03 04 05 06 07</span>
        <span class="hex-group">08 09 0A 0B 0C 0D 0E 0F</span>
      </span>
      <span role="columnheader" class="hex-ascii" style="margin-left: 2.5ch;">ASCII</span>
    </div>`;
  }

  private renderRow(row: { offset: number; bytes: number[]; ascii: string }): string {
    const GROUP_SIZE = 8;
    const groups: string[] = [];
    for (let g = 0; g < row.bytes.length; g += GROUP_SIZE) {
      const cells = row.bytes
        .slice(g, g + GROUP_SIZE)
        .map((b, i) => {
          const absOffset = row.offset + g + i;
          const cls = this.getClassForOffset(absOffset);
          const isFocused = this.focusedOffset === absOffset;
          const isSelected = this.selectedOffset === absOffset;
          return `<span role="gridcell" data-offset="${absOffset}" class="hex-cell" tabindex="${isFocused ? '0' : '-1'}"
                style="${cls.style} ${isFocused ? 'outline: 2px solid var(--color-accent); outline-offset: -2px;' : ''}"
                aria-selected="${isSelected}" aria-label="Offset ${toHex(absOffset, 8)}: ${b.toString(16).padStart(2, '0')}">
              ${b.toString(16).padStart(2, '0')}</span>`;
        })
        .join('');
      groups.push(`<span class="hex-group">${cells}</span>`);
    }

    const asciiGroups: string[] = [];
    for (let g = 0; g < row.ascii.length; g += GROUP_SIZE) {
      const cells = row.ascii
        .slice(g, g + GROUP_SIZE)
        .split('')
        .map((ch, i) => {
          const absOffset = row.offset + g + i;
          const cls = this.getClassForOffset(absOffset);
          const isFocused = this.focusedOffset === absOffset;
          const isSelected = this.selectedOffset === absOffset;
          const displayChar = ch === ' ' ? '·' : ch;
          return `<span role="gridcell" data-offset="${absOffset}" class="hex-cell hex-ascii-cell" tabindex="${isFocused ? '0' : '-1'}"
                style="${cls.style} ${isFocused ? 'outline: 2px solid var(--color-accent); outline-offset: -2px;' : ''}"
                aria-selected="${isSelected}" aria-label="Offset ${toHex(absOffset, 8)}: ASCII '${ch}'">
              ${displayChar}</span>`;
        })
        .join('');
      asciiGroups.push(`<span class="hex-group">${cells}</span>`);
    }

    return `<div role="row" class="hex-row">
      <span role="rowheader" class="hex-offset">${toHex(row.offset, 8)}</span>
      <span role="group" class="hex-groups" aria-label="Hex values">${groups.join('')}</span>
      <span role="group" class="hex-ascii" aria-label="ASCII representation">
        <span class="hex-ascii-pipe">|</span>${asciiGroups.join('')}<span class="hex-ascii-pipe">|</span>
      </span>
    </div>`;
  }

  private getClassForOffset(offset: number): { style: string } {
    for (const range of this.highlightRanges) {
      if (offset >= range.start && offset < range.end) {
        return { style: `background: ${range.color}22; outline: 1px solid ${range.color}66;` };
      }
    }
    if (this.selectedOffset === offset) {
      return { style: 'background: var(--color-accent); color: var(--color-bg);' };
    }
    return { style: '' };
  }

  private renderLegend(): string {
    if (this.highlightRanges.length === 0) return '';
    const items = this.highlightRanges
      .map((r) => `<span style="display: inline-flex; align-items: center; gap: 6px; margin-right: var(--spacing-md);">
        <span style="width: 10px; height: 10px; background: ${r.color}; border-radius: 2px;"></span>
        <span style="color: var(--color-fg-muted); font-size: 0.75rem;">${r.label}</span>
      </span>`)
      .join('');
    return `<div style="padding: var(--spacing-sm) var(--spacing-md); border-top: 1px solid var(--color-border); display: flex; flex-wrap: wrap;" aria-label="Highlight legend">${items}</div>`;
  }

  private attachEvents(): void {
    const body = this.container.querySelector('.hex-viewer-body') as HTMLElement;
    const root = this.container.querySelector('.hex-viewer') as HTMLElement;
    const gotoBtn = this.container.querySelector('.hex-goto-btn') as HTMLButtonElement;
    const searchBtn = this.container.querySelector('.hex-search-btn') as HTMLButtonElement;
    const copyBtn = this.container.querySelector('.hex-copy-btn') as HTMLButtonElement;

    body?.addEventListener('keydown', (e) => this.handleKeyDown(e));
    body?.addEventListener('click', (e) => this.handleCellClick(e));
    root?.addEventListener('keydown', (e) => this.handleRootKeyDown(e));
    root?.addEventListener('focusin', () => this.updateFocusStyles(true));
    root?.addEventListener('focusout', () => this.updateFocusStyles(false));

    gotoBtn?.addEventListener('click', () => this.showGotoDialog());
    searchBtn?.addEventListener('click', () => this.showSearchDialog());
    copyBtn?.addEventListener('click', () => this.copySelection());

    this.updateCopyButtonState();
  }

  private handleRootKeyDown(e: KeyboardEvent): void {
    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      this.showGotoDialog();
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      this.showSearchDialog();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      this.copySelection();
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const maxOffset = this.bytes.length - 1;
    let newOffset = this.focusedOffset;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newOffset = Math.min(maxOffset, this.focusedOffset + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newOffset = Math.max(0, this.focusedOffset - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newOffset = Math.min(maxOffset, this.focusedOffset + this.cols);
        break;
      case 'ArrowUp':
        e.preventDefault();
        newOffset = Math.max(0, this.focusedOffset - this.cols);
        break;
      case 'PageDown':
        e.preventDefault();
        newOffset = Math.min(maxOffset, this.focusedOffset + this.cols * this.rowsPerPage);
        break;
      case 'PageUp':
        e.preventDefault();
        newOffset = Math.max(0, this.focusedOffset - this.cols * this.rowsPerPage);
        break;
      case 'Home':
        e.preventDefault();
        newOffset = 0;
        break;
      case 'End':
        e.preventDefault();
        newOffset = maxOffset;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.selectOffset(this.focusedOffset);
        break;
      case 'Escape':
        this.clearSelection();
        break;
      default:
        return;
    }

    if (newOffset !== this.focusedOffset) {
      this.focusOffset(newOffset);
      this.scrollToOffset(newOffset);
    }
  }

  private handleCellClick(e: MouseEvent): void {
    const cell = (e.target as HTMLElement).closest('.hex-cell') as HTMLElement | null;
    if (!cell) return;
    const offset = parseInt(cell.dataset.offset || '0', 10);
    this.focusOffset(offset);
    this.selectOffset(offset);
  }

  private focusOffset(offset: number): void {
    this.focusedOffset = offset;
    this.render();
    const newCell = this.container.querySelector(`.hex-cell[data-offset="${offset}"]`) as HTMLElement;
    newCell?.focus();
  }

  private selectOffset(offset: number): void {
    this.selectedOffset = offset;
    this.updateSelectionDisplay(offset);
    this.updateCopyButtonState();
    const statusEl = this.container.querySelector('.hex-viewer-status');
    if (statusEl) statusEl.textContent = this.getStatusText();
  }

  private clearSelection(): void {
    this.selectedOffset = null;
    this.updateCopyButtonState();
    const statusEl = this.container.querySelector('.hex-viewer-status');
    if (statusEl) statusEl.textContent = this.getStatusText();
    this.render();
  }

  private scrollToOffset(offset: number): void {
    const body = this.container.querySelector('.hex-viewer-body') as HTMLElement;
    const cell = this.container.querySelector(`.hex-cell[data-offset="${offset}"]`) as HTMLElement;
    if (body && cell) {
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  private updateFocusStyles(hasFocus: boolean): void {
    const root = this.container.querySelector('.hex-viewer') as HTMLElement;
    if (root) {
      root.style.borderColor = hasFocus ? 'var(--color-accent)' : 'var(--color-border)';
      root.style.boxShadow = hasFocus ? 'var(--shadow-glow-sm)' : 'none';
    }
  }

  private updateCopyButtonState(): void {
    const copyBtn = this.container.querySelector('.hex-copy-btn') as HTMLButtonElement;
    if (copyBtn) {
      copyBtn.disabled = this.selectedOffset === null;
    }
  }

  private updateSelectionDisplay(offset: number): void {
    const statusEl = this.container.querySelector('.hex-viewer-status');
    if (statusEl) {
      statusEl.textContent = this.getStatusText();
    }
  }

  private showGotoDialog(): void {
    const input = prompt('Enter offset (hex or decimal):', '0x' + this.focusedOffset.toString(16).toUpperCase().padStart(8, '0'));
    if (input === null) return;

    let offset: number;
    try {
      offset = input.startsWith('0x') || input.startsWith('0X')
        ? parseInt(input.slice(2), 16)
        : parseInt(input, 10);
    } catch {
      alert('Invalid offset format');
      return;
    }

    if (offset < 0 || offset >= this.bytes.length) {
      alert(`Offset out of range (0 - ${this.bytes.length - 1})`);
      return;
    }

    this.focusOffset(offset);
    this.scrollToOffset(offset);
  }

  private showSearchDialog(): void {
    const input = prompt('Find bytes (hex, space-separated):', '');
    if (input === null) return;

    const searchBytes = input.trim().split(/\s+/).map((b) => parseInt(b, 16));
    if (searchBytes.some(isNaN)) {
      alert('Invalid hex bytes');
      return;
    }

    const found = this.findBytes(searchBytes);
    if (found >= 0) {
      this.focusOffset(found);
      this.selectOffset(found);
      this.scrollToOffset(found);
    } else {
      alert('Bytes not found');
    }
  }

  private findBytes(pattern: number[]): number {
    if (pattern.length === 0) return -1;
    for (let i = 0; i <= this.bytes.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (this.bytes[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  }

  private copySelection(): void {
    if (this.selectedOffset === null) return;

    const byte = this.bytes[this.selectedOffset];
    const hex = '0x' + byte.toString(16).padStart(2, '0');
    const ascii = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
    const offset = toHex(this.selectedOffset, 8);
    const text = `Offset ${offset}: ${hex} ('${ascii}')`;

    navigator.clipboard.writeText(text).then(
      () => this.showToast('Copied to clipboard'),
      () => this.showToast('Failed to copy')
    );
  }

  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      background: var(--color-bg-panel); border: 1px solid var(--color-border);
      padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md);
      font-size: 0.875rem; z-index: 1000; box-shadow: var(--shadow-lg);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
}