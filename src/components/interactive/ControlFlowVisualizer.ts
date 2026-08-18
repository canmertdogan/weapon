import { getSessionState, saveSessionState } from '../../utils/storage';

export interface CFGNode {
  id: string;
  label: string;
  code?: string[];
  x?: number;
  y?: number;
}

export interface CFGEdge {
  from: string;
  to: string;
  label?: string;
  type: 'taken' | 'fallthrough' | 'unconditional';
}

export interface ControlFlowOptions {
  nodes: CFGNode[];
  edges: CFGEdge[];
  title?: string;
  startNodeId: string;
  lessonId?: string;
}

interface SavedCFGState {
  activeNodeId: string | null;
  panZoom: { x: number; y: number; scale: number };
}

const NODE_W = 160;
const NODE_H = 64;
const GAP_X = 60;
const GAP_Y = 80;

export class ControlFlowVisualizer {
  private container: HTMLElement;
  private options: ControlFlowOptions;
  private activeNodeId: string | null;
  private highlightedEdge: CFGEdge | null;
  private svgPanZoom: { x: number; y: number; scale: number } = { x: 0, y: 0, scale: 1 };
  private isPanning: boolean = false;
  private panStart: { x: number; y: number } = { x: 0, y: 0 };
  private lessonId: string;
  private storageKey: string;

  constructor(container: HTMLElement, options: ControlFlowOptions) {
    this.container = container;
    this.options = options;
    this.lessonId = options.lessonId || 'unknown';
    this.storageKey = `weapon:cfg:${this.lessonId}`;

    // Try to restore from sessionStorage
    const saved = getSessionState<SavedCFGState>(this.storageKey);
    if (saved) {
      this.activeNodeId = saved.activeNodeId;
      this.svgPanZoom = saved.panZoom;
    } else {
      this.activeNodeId = options.startNodeId;
    }
    this.highlightedEdge = null;
    this.layoutNodes();
    this.render();
  }

  private layoutNodes(): void {
    const nodes = this.options.nodes;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const layers = new Map<string, number>();
    const visited = new Set<string>();
    const queue: string[] = [this.options.startNodeId];
    layers.set(this.options.startNodeId, 0);
    visited.add(this.options.startNodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const layer = layers.get(current)!;
      const outEdges = this.options.edges.filter((e) => e.from === current);
      for (const edge of outEdges) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          layers.set(edge.to, layer + 1);
          queue.push(edge.to);
        }
      }
    }

    const byLayer = new Map<number, string[]>();
    layers.forEach((layer, id) => {
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer)!.push(id);
    });

    byLayer.forEach((ids, layer) => {
      const totalW = ids.length * NODE_W + (ids.length - 1) * GAP_X;
      ids.forEach((id, i) => {
        const node = nodeMap.get(id)!;
        node.x = i * (NODE_W + GAP_X) - totalW / 2 + NODE_W / 2;
        node.y = layer * (NODE_H + GAP_Y);
      });
    });
  }

  private render(): void {
    const nodes = this.options.nodes;
    const edges = this.options.edges;

    const minX = Math.min(...nodes.map((n) => n.x!)) - NODE_W;
    const maxX = Math.max(...nodes.map((n) => n.x!)) + NODE_W;
    const minY = Math.min(...nodes.map((n) => n.y!)) - 20;
    const maxY = Math.max(...nodes.map((n) => n.y!)) + NODE_H + 20;
    const width = Math.max(400, maxX - minX);
    const height = Math.max(200, maxY - minY);

    const edgesSvg = edges.map((e) => this.renderEdge(e)).join('');
    const nodesSvg = nodes.map((n) => this.renderNode(n)).join('');

    this.container.innerHTML = `
      <div class="cfg-visualizer" role="region" aria-label="Control Flow Graph" tabindex="0"
           style="font-family: var(--font-mono); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
        <div class="cfg-toolbar" style="display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-sm) var(--spacing-md); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: var(--spacing-sm);">
          <span style="color: var(--color-fg-muted); font-size: 0.75rem; letter-spacing: 0.05em;">CONTROL FLOW</span>
          <div class="cfg-controls" style="display: flex; gap: var(--spacing-xs); align-items: center; flex-wrap: wrap;">
            <button class="btn btn-ghost cfg-zoom-in" aria-label="Zoom in" style="padding: 2px 8px; font-size: 0.75rem;">+</button>
            <button class="btn btn-ghost cfg-zoom-out" aria-label="Zoom out" style="padding: 2px 8px; font-size: 0.75rem;">−</button>
            <button class="btn btn-ghost cfg-zoom-reset" aria-label="Reset zoom" style="padding: 2px 8px; font-size: 0.75rem;">⟲</button>
            <span class="cfg-legend" style="color: var(--color-fg-muted); font-size: 0.6875rem; margin-left: var(--spacing-sm);">
              <span style="color: var(--color-accent);">──▸</span> taken
              <span style="color: var(--color-fg-muted); margin-left: var(--spacing-sm);">──▸</span> fallthrough
              <span style="color: var(--color-warn); margin-left: var(--spacing-sm);">──▸</span> jump
            </span>
          </div>
        </div>
        <div class="cfg-canvas-wrapper" style="overflow: auto; max-height: 400px; position: relative; touch-action: none;">
          <svg class="cfg-svg" viewBox="${minX} ${minY} ${width} ${height}" style="width: 100%; min-width: 400px; transform-origin: 0 0; transition: transform 0.1s ease-out;" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="arrow-taken" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" style="fill: var(--color-accent)"></path>
              </marker>
              <marker id="arrow-fall" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" style="fill: var(--color-fg-muted)"></path>
              </marker>
              <marker id="arrow-uncond" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" style="fill: var(--color-warn)"></path>
              </marker>
            </defs>
            <g class="cfg-edges">${edgesSvg}</g>
            <g class="cfg-nodes">${nodesSvg}</g>
          </svg>
        </div>
        <div class="cfg-detail" role="status" aria-live="polite" aria-atomic="true"
             style="padding: var(--spacing-sm) var(--spacing-md); border-top: 1px solid var(--color-border); min-height: 40px; color: var(--color-fg-muted); font-size: 0.8125rem;"></div>
        <div class="cfg-help" style="padding: var(--spacing-xs) var(--spacing-md); color: var(--color-fg-muted); font-size: 0.6875rem; border-top: 1px solid var(--color-border);">
          Click nodes to inspect. Use +/- to zoom, drag to pan. Arrow keys to navigate nodes.
        </div>
      </div>
    `;

    this.attachEvents();
    this.updateDetail();
    this.applyTransform();
  }

  private renderEdge(e: CFGEdge): string {
    const from = this.options.nodes.find((n) => n.id === e.from)!;
    const to = this.options.nodes.find((n) => n.id === e.to)!;
    if (!from || !to) return '';

    const x1 = from.x!;
    const y1 = from.y! + NODE_H;
    const x2 = to.x!;
    const y2 = to.y!;

    const isActive = this.highlightedEdge === e;
    let color = 'var(--color-fg-muted)';
    let marker = 'arrow-fall';
    if (e.type === 'taken') {
      color = 'var(--color-accent)';
      marker = 'arrow-taken';
    } else if (e.type === 'unconditional') {
      color = 'var(--color-warn)';
      marker = 'arrow-uncond';
    }

    const stroke = isActive ? 'var(--color-stack-active)' : color;
    const strokeWidth = isActive ? 3 : 2;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const label = e.label
      ? `<text x="${midX}" y="${midY - 4}" text-anchor="middle" font-size="11" style="fill: ${color}; font-family: var(--font-mono);">${e.label}</text>`
      : '';

    return `
      <path class="cfg-edge" data-edge-from="${e.from}" data-edge-to="${e.to}" data-edge-type="${e.type}"
            d="M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}"
            style="fill: none; stroke: ${stroke}; stroke-width: ${strokeWidth};"
            marker-end="url(#${marker})"></path>
      ${label}
    `;
  }

  private renderNode(n: CFGNode): string {
    const isActive = this.activeNodeId === n.id;
    const isStart = this.options.startNodeId === n.id;
    const fill = isActive ? 'var(--color-bg-elevated)' : 'var(--color-bg)';
    const stroke = isActive ? 'var(--color-accent)' : isStart ? 'var(--color-warn)' : 'var(--color-border)';
    const codeLines = (n.code || []).slice(0, 2);
    const label = n.label || n.id;

    return `
      <g class="cfg-node" data-node-id="${n.id}" tabindex="0" role="button" aria-label="${label}${n.code ? `, ${n.code.join('; ')}` : ''}" aria-pressed="${isActive}"
         style="cursor: pointer;">
        <rect x="${n.x! - NODE_W / 2}" y="${n.y!}" width="${NODE_W}" height="${NODE_H}" rx="6"
              style="fill: ${fill}; stroke: ${stroke}; stroke-width: ${isActive ? 2 : 1}; transition: stroke 150ms, fill 150ms;"></rect>
        <text x="${n.x!}" y="${n.y! + 20}" text-anchor="middle" font-size="12" font-weight="600" style="fill: var(--color-fg); font-family: var(--font-mono);">${label}</text>
        ${codeLines.map((c, i) => `<text x="${n.x!}" y="${n.y! + 36 + i * 14}" text-anchor="middle" font-size="10" style="fill: var(--color-fg-muted); font-family: var(--font-mono);">${c}</text>`).join('')}
      </g>
    `;
  }

  private attachEvents(): void {
    const svg = this.container.querySelector('.cfg-svg') as SVGSVGElement;
    const wrapper = this.container.querySelector('.cfg-canvas-wrapper') as HTMLElement;
    const root = this.container.querySelector('.cfg-visualizer') as HTMLElement;
    const zoomIn = this.container.querySelector('.cfg-zoom-in') as HTMLButtonElement;
    const zoomOut = this.container.querySelector('.cfg-zoom-out') as HTMLButtonElement;
    const zoomReset = this.container.querySelector('.cfg-zoom-reset') as HTMLButtonElement;

    // Node click/keyboard
    const nodes = this.container.querySelectorAll('.cfg-node');
    nodes.forEach((node) => {
      node.addEventListener('click', () => this.handleNodeActivate(node));
      node.addEventListener('keydown', (e) => this.handleNodeKeyDown(e as KeyboardEvent, node));
    });

    // Zoom controls
    zoomIn?.addEventListener('click', () => this.zoom(1.2));
    zoomOut?.addEventListener('click', () => this.zoom(0.833));
    zoomReset?.addEventListener('click', () => this.resetZoom());

    // Pan with mouse
    wrapper?.addEventListener('mousedown', (e) => this.startPan(e));
    wrapper?.addEventListener('mousemove', (e) => this.pan(e));
    wrapper?.addEventListener('mouseup', () => this.endPan());
    wrapper?.addEventListener('mouseleave', () => this.endPan());

    // Pan with touch
    wrapper?.addEventListener('touchstart', (e) => this.startPan(e.touches[0]), { passive: true });
    wrapper?.addEventListener('touchmove', (e) => this.pan(e.touches[0]), { passive: false });
    wrapper?.addEventListener('touchend', () => this.endPan());

    // Wheel zoom
    wrapper?.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

    // Keyboard navigation
    root?.addEventListener('keydown', (e) => this.handleRootKeyDown(e));

    // Focus styles
    root?.addEventListener('focusin', () => this.updateFocusStyles(true));
    root?.addEventListener('focusout', () => this.updateFocusStyles(false));
  }

  private handleNodeActivate(node: Element): void {
    this.activeNodeId = (node as HTMLElement).dataset.nodeId || null;
    const incoming = this.options.edges.filter((e) => e.to === this.activeNodeId);
    this.highlightedEdge = incoming.length > 0 ? incoming[0] : null;
    this.saveState();
    this.render();
    this.announceNode(node);
  }

  private handleNodeKeyDown(e: KeyboardEvent, node: Element): void {
    const nodeId = (node as HTMLElement).dataset.nodeId;
    if (!nodeId) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.handleNodeActivate(node);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.navigateToNextNode(nodeId);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.navigateToPrevNode(nodeId);
    }
  }

  private navigateToNextNode(currentId: string): void {
    const outgoing = this.options.edges.filter((e) => e.from === currentId);
    if (outgoing.length > 0) {
      const targetId = outgoing[0].to;
      const targetNode = this.container.querySelector(`.cfg-node[data-node-id="${targetId}"]`) as HTMLElement;
      targetNode?.focus();
      targetNode?.scrollIntoView({ block: 'center', inline: 'center' });
    }
  }

  private navigateToPrevNode(currentId: string): void {
    const incoming = this.options.edges.filter((e) => e.to === currentId);
    if (incoming.length > 0) {
      const targetId = incoming[0].from;
      const targetNode = this.container.querySelector(`.cfg-node[data-node-id="${targetId}"]`) as HTMLElement;
      targetNode?.focus();
      targetNode?.scrollIntoView({ block: 'center', inline: 'center' });
    }
  }

  private handleRootKeyDown(e: KeyboardEvent): void {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.zoom(1.2);
      this.saveState();
    } else if (e.key === '-') {
      e.preventDefault();
      this.zoom(0.833);
      this.saveState();
    } else if (e.key === '0') {
      e.preventDefault();
      this.resetZoom();
      this.saveState();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Pan with arrow keys when no node focused
      const activeEl = document.activeElement;
      if (!activeEl?.classList.contains('cfg-node')) {
        e.preventDefault();
        const panAmount = 50 / this.svgPanZoom.scale;
        switch (e.key) {
          case 'ArrowUp': this.svgPanZoom.y += panAmount; break;
          case 'ArrowDown': this.svgPanZoom.y -= panAmount; break;
          case 'ArrowLeft': this.svgPanZoom.x += panAmount; break;
          case 'ArrowRight': this.svgPanZoom.x -= panAmount; break;
        }
        this.applyTransform();
        this.saveState();
      }
    }
  }

  private handleWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom(factor);
      this.saveState();
    }
  }

  private startPan(e: MouseEvent | Touch): void {
    this.isPanning = true;
    this.panStart = { x: e.clientX - this.svgPanZoom.x, y: e.clientY - this.svgPanZoom.y };
    (this.container.querySelector('.cfg-canvas-wrapper') as HTMLElement)?.style.setProperty('cursor', 'grabbing');
  }

  private pan(e: MouseEvent | Touch): void {
    if (!this.isPanning) return;
    this.svgPanZoom.x = e.clientX - this.panStart.x;
    this.svgPanZoom.y = e.clientY - this.panStart.y;
    this.applyTransform();
  }

  private endPan(): void {
    this.isPanning = false;
    (this.container.querySelector('.cfg-canvas-wrapper') as HTMLElement)?.style.removeProperty('cursor');
    this.saveState();
  }

  private zoom(factor: number): void {
    this.svgPanZoom.scale = Math.max(0.25, Math.min(4, this.svgPanZoom.scale * factor));
    this.applyTransform();
  }

  private resetZoom(): void {
    this.svgPanZoom = { x: 0, y: 0, scale: 1 };
    this.applyTransform();
  }

  private applyTransform(): void {
    const svg = this.container.querySelector('.cfg-svg') as SVGSVGElement;
    if (svg) {
      svg.style.transform = `translate(${this.svgPanZoom.x}px, ${this.svgPanZoom.y}px) scale(${this.svgPanZoom.scale})`;
    }
  }

  private updateDetail(): void {
    const detail = this.container.querySelector('.cfg-detail');
    if (!detail) return;
    const node = this.options.nodes.find((n) => n.id === this.activeNodeId);
    if (node) {
      const code = (node.code || []).join(' · ');
      detail.innerHTML = `<span style="color: var(--color-accent); font-weight: 600;">${node.label}</span>${code ? ` — ${code}` : ''}`;
    }
  }

  private announceNode(node: Element): void {
    const label = node.getAttribute('aria-label') || '';
    const detail = this.container.querySelector('.cfg-detail');
    if (detail) {
      detail.textContent = `Selected: ${label}`;
    }
  }

  private updateFocusStyles(hasFocus: boolean): void {
    const root = this.container.querySelector('.cfg-visualizer') as HTMLElement;
    if (root) {
      root.style.borderColor = hasFocus ? 'var(--color-accent)' : 'var(--color-border)';
      root.style.boxShadow = hasFocus ? 'var(--shadow-glow-sm)' : 'none';
    }
  }

  private saveState(): void {
    const state: SavedCFGState = {
      activeNodeId: this.activeNodeId,
      panZoom: this.svgPanZoom,
    };
    saveSessionState(this.storageKey, state);
  }
}