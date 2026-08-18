interface NotesData {
  [lessonId: string]: {
    content: string;
    updated: number;
  };
}

const NOTES_KEY = 'weapon:notes';

function loadNotes(): NotesData {
  try {
    const stored = localStorage.getItem(NOTES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveNotes(notes: NotesData): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch (e) {
    console.warn('Failed to save notes:', e);
  }
}

export function getLessonNotes(lessonId: string): string {
  const notes = loadNotes();
  return notes[lessonId]?.content || '';
}

export function setLessonNotes(lessonId: string, content: string): void {
  const notes = loadNotes();
  notes[lessonId] = { content, updated: Date.now() };
  saveNotes(notes);
}

export function deleteLessonNotes(lessonId: string): void {
  const notes = loadNotes();
  delete notes[lessonId];
  saveNotes(notes);
}

export function exportNotes(): string {
  const notes = loadNotes();
  return JSON.stringify({
    version: 1,
    timestamp: Date.now(),
    notes,
  }, null, 2);
}

export function importNotes(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (data.notes) {
      saveNotes(data.notes);
      return true;
    }
  } catch {}
  return false;
}

export class LessonNotes {
  private container: HTMLElement;
  private lessonId: string;
  private textarea: HTMLTextAreaElement | null = null;
  private saveTimer: number | null = null;

  constructor(container: HTMLElement, lessonId: string) {
    this.container = container;
    this.lessonId = lessonId;
    this.render();
  }

  private render(): void {
    const content = getLessonNotes(this.lessonId);

    this.container.innerHTML = `
      <div class="lesson-notes" style="font-family: var(--font-ui);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
          <h4 style="font-family: var(--font-display); font-size: 0.875rem; font-weight: 600;">Notes</h4>
          <div style="display: flex; gap: var(--spacing-xs);">
            <button class="notes-export btn btn-ghost" aria-label="Export notes for every lesson" title="Export notes for every lesson" style="padding: 2px 8px; font-size: 0.75rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </button>
            <button class="notes-import btn btn-ghost" aria-label="Import notes, replacing every lesson's notes" title="Import notes, replacing every lesson's notes" style="padding: 2px 8px; font-size: 0.75rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 8 12 3 17 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </button>
            <input type="file" class="notes-import-file hidden" accept=".json" />
          </div>
        </div>
        <textarea class="notes-textarea" aria-label="Lesson notes" spellcheck="true"
                  style="width: 100%; min-height: 120px; padding: var(--spacing-sm); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-fg); font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.6; resize: vertical; outline: none;"
                  placeholder="Take notes for this lesson... (Markdown supported)">${this.escapeHtml(content)}</textarea>
        <div class="notes-status" style="margin-top: var(--spacing-xs); font-size: 0.6875rem; color: var(--color-fg-muted); font-family: var(--font-mono);">
          Auto-saves as you type. Press Ctrl+S to force save.
        </div>
      </div>
    `;

    this.textarea = this.container.querySelector('.notes-textarea') as HTMLTextAreaElement;
    this.attachEvents();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#039;');
  }

  private attachEvents(): void {
    if (!this.textarea) return;

    // Auto-save on input
    this.textarea.addEventListener('input', () => {
      this.scheduleSave();
    });

    // Force save on Ctrl+S
    this.textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveNow();
      }
    });

    // Export notes
    this.container.querySelector('.notes-export')?.addEventListener('click', () => {
      this.export();
    });

    // Import notes
    const importBtn = this.container.querySelector('.notes-import') as HTMLButtonElement;
    const importFile = this.container.querySelector('.notes-import-file') as HTMLInputElement;
    importBtn?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const confirmed = confirm(
        'Importing will replace your notes for every lesson, not just this one. Continue?'
      );
      if (!confirmed) {
        importFile.value = '';
        return;
      }
      const text = await file.text();
      if (importNotes(text)) {
        this.showStatus('Notes imported for all lessons');
        this.textarea!.value = getLessonNotes(this.lessonId);
      } else {
        this.showStatus('Failed to import notes', true);
      }
      importFile.value = '';
    });
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 1000);
  }

  private saveNow(): void {
    if (!this.textarea) return;
    setLessonNotes(this.lessonId, this.textarea.value);
    this.showStatus('Saved');
  }

  private export(): void {
    const json = exportNotes();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weapon-notes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showStatus('Notes exported');
  }

  private showStatus(message: string, isError = false): void {
    const statusEl = this.container.querySelector('.notes-status') as HTMLElement | null;
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.color = isError ? 'var(--color-danger)' : 'var(--color-accent)';
      setTimeout(() => {
        statusEl.textContent = 'Auto-saves as you type. Press Ctrl+S to force save.';
        statusEl.style.color = 'var(--color-fg-muted)';
      }, 2000);
    }
  }
}