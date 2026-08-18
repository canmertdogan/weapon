export interface LabQuestion {
  id: string;
  type: 'string' | 'offset' | 'number';
  prompt: string;
  answer: string;
}

export interface LabBinary {
  format: 'PE' | 'ELF' | 'raw';
  name: string;
  file?: string;
  hex?: string;
  bytes?: number;
}

export interface LabManifest {
  id: string;
  title: string;
  module: string;
  lesson: string;
  description: string;
  difficulty: 'Trivial' | 'Easy' | 'Medium' | 'Hard' | 'Extreme';
  estimatedTime: number;
  prerequisites: string[];
  binary: LabBinary | null;
  code?: {
    labels: Record<string, number>;
    instructions: { address: number; op: string; args: string[] }[];
  };
  questions: LabQuestion[];
  hints: string[];
  methodology: string;
  commonPitfalls: string[];
  tools: string[];
  references: string[];
  extensions: string[];
  solution: string;
}

export interface LabIndexEntry {
  id: string;
  title: string;
  module: string;
  lesson: string;
  description: string;
  difficulty: string;
  unlocked: boolean;
}
