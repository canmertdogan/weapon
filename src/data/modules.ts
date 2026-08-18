export interface ModuleMeta {
  id: string;
  label: string;
  order: number;
  summary: string;
}

export const MODULES: ModuleMeta[] = [
  { id: 'start', label: 'START', order: 0, summary: 'Orientation: what reverse engineering is and how to think like a reverse engineer.' },
  { id: 'foundations', label: '01 FOUNDATIONS', order: 1, summary: 'Binary anatomy, CPU fundamentals, memory layout, and executable formats.' },
  { id: 'assembly', label: '02 ASSEMBLY', order: 2, summary: 'Registers, instructions, the stack, functions, control flow, bit tricks, SIMD, and how it all encodes to bytes.' },
  { id: 'static-analysis', label: '03 STATIC ANALYSIS', order: 3, summary: 'Strings, imports, functions, cross references, and decompilation.' },
  { id: 'debugging', label: '04 DEBUGGING', order: 4, summary: 'Breakpoints, register inspection, execution flow, and anti-debugging.' },
  { id: 'exploit-dev', label: '05 EXPLOIT DEVELOPMENT', order: 5, summary: 'Stack overflows, shellcode, memory protections, and return-oriented programming.' },
  { id: 'windows', label: '06 WINDOWS', order: 6, summary: 'The PE format, processes, threads, DLLs, and the Windows API.' },
  { id: 'linux', label: '07 LINUX', order: 7, summary: 'The ELF format, processes and syscalls, the dynamic linker, and Linux-native tooling.' },
  { id: 'arm-mobile', label: '08 ARM64 & MOBILE', order: 8, summary: 'ARM64 architecture, calling conventions, and reversing Android and iOS apps.' },
  { id: 'malware', label: '09 MALWARE ANALYSIS', order: 9, summary: 'Behavior, persistence, C2, obfuscation, and IOC extraction.' },
  { id: 'anti-re', label: '10 ANTI-RE & OBFUSCATION', order: 10, summary: 'Manual unpacking, VM-based obfuscation, control flow flattening, and anti-disassembly.' },
  { id: 'final', label: 'FINAL', order: 11, summary: 'The Unknown Binary — a capstone investigation that ties everything together.' },
];

export function getModuleMeta(id: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.id === id);
}
