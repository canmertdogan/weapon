export interface ModuleMeta {
  id: string;
  label: string;
  order: number;
  summary: string;
  locked: boolean;
}

export const MODULES: ModuleMeta[] = [
  { id: 'start', label: 'START', order: 0, summary: 'Orientation: what reverse engineering is and how to think like a reverse engineer.', locked: false },
  { id: 'foundations', label: '01 FOUNDATIONS', order: 1, summary: 'Binary anatomy, CPU fundamentals, memory layout, and executable formats.', locked: false },
  { id: 'assembly', label: '02 ASSEMBLY', order: 2, summary: 'Registers, instructions, the stack, functions, control flow, bit tricks, SIMD, and how it all encodes to bytes.', locked: false },
  { id: 'static-analysis', label: '03 STATIC ANALYSIS', order: 3, summary: 'Strings, imports, functions, cross references, and decompilation.', locked: false },
  { id: 'debugging', label: '04 DEBUGGING', order: 4, summary: 'Breakpoints, register inspection, execution flow, and anti-debugging.', locked: false },
  { id: 'exploit-dev', label: '05 EXPLOIT DEVELOPMENT', order: 5, summary: 'Stack overflows, shellcode, memory protections, and return-oriented programming.', locked: false },
  { id: 'windows', label: '06 WINDOWS', order: 6, summary: 'The PE format, processes, threads, DLLs, and the Windows API.', locked: false },
  { id: 'linux', label: '07 LINUX', order: 7, summary: 'The ELF format, processes and syscalls, the dynamic linker, and Linux-native tooling.', locked: false },
  { id: 'arm-mobile', label: '08 ARM64 & MOBILE', order: 8, summary: 'ARM64 architecture, calling conventions, and reversing Android and iOS apps.', locked: false },
  { id: 'malware', label: '09 MALWARE ANALYSIS', order: 9, summary: 'Behavior, persistence, C2, obfuscation, and IOC extraction.', locked: false },
  { id: 'anti-re', label: '10 ANTI-RE & OBFUSCATION', order: 10, summary: 'Manual unpacking, VM-based obfuscation, control flow flattening, and anti-disassembly.', locked: false },
  { id: 'final', label: 'FINAL', order: 11, summary: 'The Unknown Binary — a capstone investigation that ties everything together.', locked: false },
];

export function getModuleMeta(id: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.id === id);
}
