export type InteractiveComponentType =
  | 'HexViewerIsland'
  | 'AssemblyVisualizerIsland'
  | 'StackVisualizerIsland'
  | 'InstructionPlaygroundIsland'
  | 'ControlFlowVisualizerIsland'
  | 'DebuggerSimulatorIsland';

export interface BaseInteractiveProps {
  title?: string;
}

export interface HexViewerProps extends BaseInteractiveProps {
  data: string;
  mode?: 'raw' | 'pe';
  highlightRanges?: HighlightRange[];
}

export interface HighlightRange {
  start: number;
  end: number;
  label: string;
  color: string;
}

export interface AssemblyVisualizerProps extends BaseInteractiveProps {
  instructions: string[];
  initialRegisters?: Partial<Record<string, bigint>>;
  initialFlags?: Partial<Record<string, boolean>>;
}

export interface StackVisualizerProps extends BaseInteractiveProps {
  instructions: string[];
  initialStack?: StackEntry[];
}

export interface StackEntry {
  address: number;
  value: bigint;
  label: string;
}

export interface InstructionPlaygroundProps extends BaseInteractiveProps {
  initialCode: string;
  availableRegisters?: string[];
}

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

export interface ControlFlowVisualizerProps extends BaseInteractiveProps {
  nodes: CFGNode[];
  edges: CFGEdge[];
  startNodeId: string;
}

export interface DebuggerProgram {
  labels: Record<string, number>;
  code: DebuggerInstruction[];
}

export interface DebuggerInstruction {
  address: number;
  op: string;
  args: string[];
}

export interface DebuggerSimulatorProps extends BaseInteractiveProps {
  labels: Record<string, number>;
  code: DebuggerInstruction[];
  breakpoints?: number[];
  watchExpressions?: string[];
}

export type InteractiveProps =
  | HexViewerProps
  | AssemblyVisualizerProps
  | StackVisualizerProps
  | InstructionPlaygroundProps
  | ControlFlowVisualizerProps
  | DebuggerSimulatorProps;

export type InteractiveConfig =
  | { component: 'HexViewerIsland'; props: HexViewerProps }
  | { component: 'AssemblyVisualizerIsland'; props: AssemblyVisualizerProps }
  | { component: 'StackVisualizerIsland'; props: StackVisualizerProps }
  | { component: 'InstructionPlaygroundIsland'; props: InstructionPlaygroundProps }
  | { component: 'ControlFlowVisualizerIsland'; props: ControlFlowVisualizerProps }
  | { component: 'DebuggerSimulatorIsland'; props: DebuggerSimulatorProps };

export type InteractiveEventMap = {
  'interactive:mount': { component: InteractiveComponentType; container: HTMLElement };
  'interactive:unmount': { component: InteractiveComponentType };
  'interactive:error': { component: InteractiveComponentType; error: Error };
  'interactive:step': { component: InteractiveComponentType; step: number };
  'interactive:reset': { component: InteractiveComponentType };
};

export interface InteractiveError extends Error {
  component?: InteractiveComponentType;
  recoverable?: boolean;
}