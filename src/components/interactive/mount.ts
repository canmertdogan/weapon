import { HexViewer } from './HexViewer';
import { AssemblyVisualizer } from './AssemblyVisualizer';
import { StackVisualizer } from './StackVisualizer';
import { InstructionPlayground } from './InstructionPlayground';
import { ControlFlowVisualizer } from './ControlFlowVisualizer';
import { DebuggerSimulator } from './DebuggerSimulator';

interface ComponentConstructor {
  new (container: HTMLElement, options: any): any;
}

const componentRegistry: Record<string, ComponentConstructor> = {
  'hexviewer': HexViewer,
  'assembly-visualizer': AssemblyVisualizer,
  'stack-visualizer': StackVisualizer,
  'instruction-playground': InstructionPlayground,
  'control-flow': ControlFlowVisualizer,
  'debugger-simulator': DebuggerSimulator,
};

function createErrorFallback(container: HTMLElement, name: string, error: Error): void {
  container.innerHTML = `
    <div class="interactive-error" style="
      font-family: var(--font-ui);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-danger);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
      color: var(--color-danger);
    ">
      <div style="display: flex; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <strong>Interactive component failed to load</strong>
      </div>
      <p style="font-size: 0.875rem; margin-bottom: var(--spacing-sm);">
        The <code style="font-family: var(--font-mono);">${name}</code> component encountered an error.
      </p>
      <details style="font-size: 0.75rem; color: var(--color-fg-muted);">
        <summary>Error details</summary>
        <pre style="margin-top: var(--spacing-xs); overflow: auto; max-height: 120px;">${error.message}</pre>
      </details>
      <button class="btn btn-secondary retry-mount" style="margin-top: var(--spacing-sm); font-size: 0.75rem;">
        Retry
      </button>
    </div>
  `;

  const retryBtn = container.querySelector('.retry-mount');
  retryBtn?.addEventListener('click', () => {
    mountSingle(container, name);
  });
}

function mountSingle(container: HTMLElement, name: string): void {
  const Component = componentRegistry[name];
  if (!Component) {
    console.warn('Unknown component:', name);
    return;
  }

  let props: Record<string, unknown> = {};
  try {
    props = JSON.parse(container.dataset.weaponProps || '{}');
  } catch (e) {
    console.warn('Failed to parse component props', e);
  }

  try {
    new Component(container, props);
    container.dataset.mounted = 'true';
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`Failed to mount ${name}:`, err);
    createErrorFallback(container, name, err);
    dispatchInteractiveError(name, err);
  }
}

function dispatchInteractiveError(component: string, error: Error): void {
  window.dispatchEvent(new CustomEvent('interactive:error', {
    detail: { component, error, recoverable: true },
  }));
}

export function mountInteractives(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-weapon-component]').forEach((el) => {
    if (el.dataset.mounted === 'true') return;

    const name = el.dataset.weaponComponent;
    if (!name) return;

    mountSingle(el, name);
  });
}

export function unmountInteractives(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-weapon-component][data-mounted="true"]').forEach((el) => {
    // Components don't have a standard destroy method yet
    // This is a placeholder for future cleanup
    el.dataset.mounted = 'false';
    el.innerHTML = '';
  });
}