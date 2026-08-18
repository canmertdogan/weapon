import {
  LESSON_SAMPLES,
  samplePE,
  peHighlightRanges,
  registerDemo,
  stackDemo,
  arithmeticDemo,
  controlFlowDemo,
} from '../data/samples';
import type { InteractiveConfig, InteractiveComponentType } from '../types/interactive';

export function getInteractiveProps(lessonId: string, interactive: string): InteractiveConfig | null {
  const direct = LESSON_SAMPLES[lessonId];
  if (direct) return direct;

  const fallback = createFallbackConfig(interactive as InteractiveComponentType);
  return fallback;
}

function createFallbackConfig(type: InteractiveComponentType): InteractiveConfig | null {
  switch (type) {
    case 'HexViewerIsland':
      return {
        component: 'HexViewerIsland',
        props: { data: samplePE, mode: 'pe', highlightRanges: peHighlightRanges },
      };
    case 'AssemblyVisualizerIsland':
      return { component: 'AssemblyVisualizerIsland', props: { instructions: registerDemo } };
    case 'StackVisualizerIsland':
      return { component: 'StackVisualizerIsland', props: { instructions: stackDemo } };
    case 'InstructionPlaygroundIsland':
      return { component: 'InstructionPlaygroundIsland', props: { initialCode: arithmeticDemo } };
    case 'ControlFlowVisualizerIsland':
      return { component: 'ControlFlowVisualizerIsland', props: controlFlowDemo };
    case 'DebuggerSimulatorIsland':
      return { component: 'DebuggerSimulatorIsland', props: { code: [], labels: {} } };
    default:
      return null;
  }
}

export function validateInteractiveConfig(config: unknown): config is InteractiveConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c.component === 'string' &&
    c.props !== undefined &&
    typeof c.props === 'object'
  );
}