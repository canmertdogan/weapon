import type { LessonNode, ModuleNode } from '../utils/course';
import { BASE } from '../utils/base';
import Fuse from 'fuse.js';

interface SearchItem {
  type: 'lesson' | 'lab' | 'module';
  id: string;
  title: string;
  description: string;
  href: string;
  module?: string;
  moduleLabel?: string;
}

class CommandPalette {
  private container: HTMLElement;
  private input: HTMLInputElement | null = null;
  private resultsEl: HTMLElement | null = null;
  private items: SearchItem[] = [];
  private fuse: Fuse<SearchItem>;
  private isOpen = false;
  private selectedIndex = -1;
  private onCloseCallbacks: (() => void)[] = [];

  constructor(modules: ModuleNode[], labs: { id: string; title: string; module: string; description: string }[]) {
    this.buildIndex(modules, labs);
    this.fuse = new Fuse(this.items, {
      keys: ['title', 'description', 'moduleLabel'],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 2,
    });
    this.container = this.createContainer();
    document.body.appendChild(this.container);
    this.bindGlobalShortcut();
  }

  private buildIndex(modules: ModuleNode[], labs: { id: string; title: string; module: string; description: string }[]): void {
    const moduleMap = new Map(modules.map(m => [m.id, m.label]));

    for (const module of modules) {
      this.items.push({
        type: 'module',
        id: module.id,
        title: module.label,
        description: module.summary,
        href: `${BASE}course/${module.id}`,
        moduleLabel: module.label,
      });

      for (const lesson of module.lessons) {
        this.items.push({
          type: 'lesson',
          id: lesson.id,
          title: lesson.title,
          description: lesson.objectives.join('; '),
          href: lesson.href,
          module: module.id,
          moduleLabel: module.label,
        });
      }
    }

    for (const lab of labs) {
      const modLabel = moduleMap.get(lab.module) || lab.module;
      this.items.push({
        type: 'lab',
        id: lab.id,
        title: lab.title,
        description: lab.description,
        href: `${BASE}labs/${lab.id}`,
        module: lab.module,
        moduleLabel: modLabel,
      });
    }
  }

  private createContainer(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'command-palette';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Command palette');
    el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      display: none;
      align-items: flex-start;
      justify-content: center;
      padding-top: 10vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
    `;
    el.innerHTML = `
      <div class="palette-panel" style="
        width: 100%;
        max-width: 720px;
        margin: 0 var(--spacing-lg);
        background: var(--color-bg-panel);
        border: 1px solid var(--color-border-strong);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        transform: translateY(-20px);
        opacity: 0;
        transition: transform 0.15s ease-out, opacity 0.15s ease-out;
      ">
        <div class="palette-input-wrapper" style="position: relative; padding: var(--spacing-md); border-bottom: 1px solid var(--color-border);">
          <svg class="palette-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               style="position: absolute; left: var(--spacing-md); top: 50%; transform: translateY(-50%); color: var(--color-fg-muted);">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="palette-input" placeholder="Search lessons, labs, modules…" autocomplete="off" spellcheck="false"
                 style="width: 100%; padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm) 48px;
                        background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md);
                        color: var(--color-fg); font-family: var(--font-ui); font-size: 1rem; outline: none;">
          <kbd class="palette-hint" style="position: absolute; right: var(--spacing-md); top: 50%; transform: translateY(-50%);
                        font-family: var(--font-mono); font-size: 0.6875rem; color: var(--color-fg-muted); padding: 2px 6px;
                        background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
            ⌘K
          </kbd>
        </div>
        <div class="palette-results" role="listbox" aria-label="Search results"
             style="max-height: 50vh; overflow: auto; padding: var(--spacing-sm);"></div>
        <div class="palette-footer" style="padding: var(--spacing-sm) var(--spacing-md); border-top: 1px solid var(--color-border);
                        font-family: var(--font-mono); font-size: 0.6875rem; color: var(--color-fg-muted); text-align: center;">
          ↑↓ Navigate · ⏎ Open · ⎋ Close
        </div>
      </div>
    `;
    return el;
  }

  private bindGlobalShortcut(): void {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  private toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.isOpen = true;
    this.container.style.display = 'flex';
    requestAnimationFrame(() => {
      const panel = this.container.querySelector('.palette-panel') as HTMLElement;
      if (panel) {
        panel.style.transform = 'translateY(0)';
        panel.style.opacity = '1';
      }
    });
    this.input = this.container.querySelector('.palette-input') as HTMLInputElement;
    this.resultsEl = this.container.querySelector('.palette-results') as HTMLElement;
    this.input?.focus();
    this.input?.addEventListener('input', () => this.handleInput());
    this.input?.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.container.addEventListener('click', (e) => this.handleClick(e));
    this.renderResults(this.items.slice(0, 10));
  }

  close(): void {
    this.isOpen = false;
    const panel = this.container.querySelector('.palette-panel') as HTMLElement;
    if (panel) {
      panel.style.transform = 'translateY(-20px)';
      panel.style.opacity = '0';
    }
    setTimeout(() => {
      this.container.style.display = 'none';
      this.input = null;
      this.resultsEl = null;
      this.selectedIndex = -1;
    }, 150);
    this.onCloseCallbacks.forEach(cb => cb());
  }

  onClose(cb: () => void): void {
    this.onCloseCallbacks.push(cb);
  }

  private handleInput(): void {
    const query = this.input?.value || '';
    this.selectedIndex = -1;
    if (!query.trim()) {
      this.renderResults(this.items.slice(0, 10));
      return;
    }
    const results = this.fuse.search(query).slice(0, 15).map(r => r.item);
    this.renderResults(results);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const results = this.resultsEl?.querySelectorAll('[role="option"]');
    const count = results?.length || 0;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(count - 1, this.selectedIndex + 1);
      this.updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(-1, this.selectedIndex - 1);
      this.updateSelection();
    } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
      e.preventDefault();
      const item = results?.[this.selectedIndex];
      if (item) {
        const href = item.getAttribute('data-href');
        if (href) {
          this.close();
          window.location.href = href;
        }
      }
    } else if (e.key === 'Escape') {
      this.close();
    }
  }

  private updateSelection(): void {
    const results = this.resultsEl?.querySelectorAll('[role="option"]');
    results?.forEach((el, i) => {
      const selected = i === this.selectedIndex;
      el.setAttribute('aria-selected', String(selected));
      (el as HTMLElement).style.background = selected ? 'var(--color-accent)' : '';
      (el as HTMLElement).style.color = selected ? 'var(--color-bg)' : '';
      if (selected) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const item = target.closest('[role="option"]');
    if (item) {
      const href = item.getAttribute('data-href');
      if (href) {
        this.close();
        window.location.href = href;
      }
    }
    if (target === this.container) {
      this.close();
    }
  }

  private renderResults(results: SearchItem[]): void {
    if (!this.resultsEl) return;
    if (results.length === 0) {
      this.resultsEl.innerHTML = `
        <div role="option" aria-selected="false" style="padding: var(--spacing-lg); text-align: center; color: var(--color-fg-muted);">
          No results found
        </div>
      `;
      return;
    }
    this.resultsEl.innerHTML = results.map((item, i) => `
      <div role="option" aria-selected="${i === this.selectedIndex}" data-href="${item.href}"
           class="palette-item" tabindex="-1"
           style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md);
                  border-radius: var(--radius-md); cursor: pointer; transition: background 0.1s;
                  ${i === this.selectedIndex ? 'background: var(--color-accent); color: var(--color-bg);' : ''}">
        <span class="palette-type" style="font-family: var(--font-mono); font-size: 0.6875rem; text-transform: uppercase;
                        color: ${item.type === 'lab' ? 'var(--color-warn)' : item.type === 'module' ? 'var(--color-accent)' : 'var(--color-fg-muted)'};
                        background: ${item.type === 'lab' ? 'var(--color-warn)15' : item.type === 'module' ? 'var(--color-accent)15' : 'var(--color-fg-muted)15'};
                        padding: 2px 6px; border-radius: var(--radius-sm); flex-shrink: 0;">
          ${item.type.toUpperCase()}
        </span>
        <div class="palette-content" style="flex: 1; min-width: 0;">
          <div class="palette-title" style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${this.escapeHtml(item.title)}
          </div>
          <div class="palette-meta" style="font-size: 0.8125rem; color: var(--color-fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${this.escapeHtml(item.moduleLabel || '')}
          </div>
        </div>
      </div>
    `).join('');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#039;');
  }
}

let paletteInstance: CommandPalette | null = null;

export function initCommandPalette(modules: ModuleNode[], labs: { id: string; title: string; module: string; description: string }[]): CommandPalette {
  if (!paletteInstance) {
    paletteInstance = new CommandPalette(modules, labs);
  }
  return paletteInstance;
}

export function getCommandPalette(): CommandPalette | null {
  return paletteInstance;
}