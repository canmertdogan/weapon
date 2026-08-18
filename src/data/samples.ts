export const samplePE =
  '4D5A9000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000546869732070726F6772616D2063616E6E6F742062652072756E20696E20444F53206D6F64652E0D0D0A24000000000000000000000000000000000000000000504500006486030000B0425F0000000000000000F00022000B020E0000020000000400000000000000100000001000000000004001000000001000000002000006000000000000000600000000000000005000000004000000000000030060810000100000000000001000000000000000001000000000000010000000000000000000001000000000000000000000000020000050000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002E7465787400000000020000001000000002000000040000000000000000000000000000200000602E7264617461000000010000002000000002000000060000000000000000000000000000400000402E6461746100000000010000003000000002000000080000000000000000000000000000400000C000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004883EC28E81B0000004883C428C30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004B45524E454C33322E646C6C0047657453746448616E646C6500577269746546696C65004578697450726F63657373000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

export const peHighlightRanges = [
  { start: 0x00, end: 0x40, label: 'DOS Header', color: '#8A8A94' },
  { start: 0x80, end: 0x84, label: 'PE Signature', color: '#FF2B3A' },
  { start: 0x84, end: 0x98, label: 'COFF File Header', color: '#FF5A3C' },
  { start: 0x98, end: 0x188, label: 'Optional Header', color: '#FF2B3A' },
  { start: 0x188, end: 0x200, label: 'Section Table', color: '#FF3B4D' },
  { start: 0x400, end: 0x40e, label: '.text code', color: '#FF2B3A' },
  { start: 0x600, end: 0x630, label: '.rdata imports', color: '#FF5A3C' },
];

export const stringsSampleHex =
  '4D5A0000000000000000000000000000687474703A2F2F63322E6578616D706C652E636F6D2F626561636F6E0000000000000000000000000000000000000000536F6674776172655C4D6963726F736F66745C57696E646F77735C43757272656E7456657273696F6E5C52756E00000000000000000000000000000000000000476C6F62616C5C4D757465785F30783746334100000000000000000000000000436F6E6669672E6461740000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

export const stringsHighlightRanges = [
  { start: 0x10, end: 0x2b, label: 'C2 URL', color: '#FF3B4D' },
  { start: 0x40, end: 0x6d, label: 'Run key', color: '#FF5A3C' },
  { start: 0x80, end: 0x92, label: 'Mutex name', color: '#FF2B3A' },
];

export const malwareStringsHex =
  '4D5A0000000000000000000000000000636D642E657865202F632077686F616D69000000000000000000000000000000706F7765727368656C6C202D6E6F70202D772068696464656E202D656E630000000000000000000000000000000000002554454D50255C737663686F73742E657865000000000000000000000000000043726561746552656D6F746554687265616400000000000000000000000000005669727475616C416C6C6F63457800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

export const packedHex =
  '4D5A000000000000000000000000000000000000000000000000000000000000555058210000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000504500006486020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000555058300000000000000000000000000000000000020000000000000000000000000000800000E0555058310000000000000000000000000001000000020000000000000000000000000000400000E0000000000000000000000000000000000000000000000000000000000000000000000000000000000726456483A2C1E0FF1E3D5C7B9AB9D8F71635547392B1D0EF0E2D4C6B8AA9C8E70625446382A1C0DFFE1D3C5B7A99B8D7F61534537291B0CFEE0D2C4B6A89A8C7E60524436281A0BFDEFD1C3B5A7998B7D6F51433527190AFCEED0C2B4A6988A7C6E504234261809FBEDDFC1B3A597897B6D5F4133251708FAECDEC0B2A496887A6C5E4032241607F9EBDDCFB1A39587796B5D4F31231506F8EADCCEB0A29486786A5C4E30221405F7E9DBCDBFA1938577695B4D3F211304F6E8DACCBEA0928476685A4C3E201203F5E7D9CBBDAF91837567594B3D2F1102F4E6D8CABCAE90827466584A3C2E1001F3E5D7C9BBAD9F81736557493B2D1F00F2E4D6C8BAAC9E8';

export const packedHighlightRanges = [
  { start: 0x20, end: 0x24, label: 'UPX! signature', color: '#FF3B4D' },
  { start: 0x84, end: 0x98, label: 'COFF header', color: '#FF5A3C' },
  { start: 0x200, end: 0x300, label: 'Compressed payload', color: '#FF2B3A' },
];

export const elfHex =
  '7f454c4602010100000000000000000003003e00010000002010000000000000400000000000000000200000000000000000000040003800040040001e001d000600000004000000400000000000000040000000000000004000000000000000e000000000000000e000000000000000080000000000000003000000040000002001000000000000200100000000000020010000000000001c000000000000001c000000000000000100000000000000010000000500000000000000000000000000000000000000000000000000000000100000000000000010000000000000001000000000000001000000060000000010000000000000001020000000000000102000000000003002000000000000380200000000000000100000000000002f6c696236342f6c642d6c696e75782d7838362d36342e736f2e320000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

export const elfHighlightRanges = [
  { start: 0x00, end: 0x10, label: 'e_ident (ELF magic)', color: '#8A8A94' },
  { start: 0x10, end: 0x18, label: 'Type / Machine / Version', color: '#FF5A3C' },
  { start: 0x18, end: 0x20, label: 'e_entry (entry point)', color: '#FF2B3A' },
  { start: 0x20, end: 0x28, label: 'e_phoff (program headers)', color: '#FF5A3C' },
  { start: 0x28, end: 0x40, label: 'Section info + sizes', color: '#8A8A94' },
  { start: 0x40, end: 0x120, label: 'Program Header Table', color: '#FF3B4D' },
  { start: 0x120, end: 0x13c, label: 'PT_INTERP path string', color: '#FF2B3A' },
];

export const shiftDemo = "mov rax, 0x1\nshl rax, 4\nmov rbx, 0xFFFFFFFFFFFFFF00\nsar rbx, 4\nmov rcx, 0x8000000000000001\nrol rcx, 1\nbsf rdx, rax\npopcnt rsi, rbx";

export const instructionEncodingHex = '4801d8b8785634128945f8';

export const instructionEncodingHighlightRanges = [
  { start: 0x00, end: 0x01, label: 'REX.W prefix (0x48)', color: '#c41424' },
  { start: 0x01, end: 0x02, label: 'Opcode 0x01 — ADD r/m64, r64', color: '#FF2B3A' },
  { start: 0x02, end: 0x03, label: 'ModRM 0xD8 — add rax, rbx', color: '#FF3B4D' },
  { start: 0x03, end: 0x04, label: 'Opcode 0xB8 — MOV eax, imm32', color: '#FF2B3A' },
  { start: 0x04, end: 0x08, label: 'Immediate 0x12345678 (little-endian)', color: '#FF5A3C' },
  { start: 0x08, end: 0x09, label: 'Opcode 0x89 — MOV r/m32, r32', color: '#FF2B3A' },
  { start: 0x09, end: 0x0a, label: 'ModRM 0x45 — [rbp+disp8], eax', color: '#FF3B4D' },
  { start: 0x0a, end: 0x0b, label: 'Displacement 0xF8 (-8)', color: '#FF5A3C' },
];

export const registerDemo = [
  'mov rax, 5',
  'add rax, 3',
  'sub rax, 1',
  'cmp rax, 7',
  'mov rbx, rax',
];

export const dataMovementDemo = [
  'mov rax, 0x1122334455667788',
  'mov eax, 0xAABBCCDD',
  'mov al, 0xEF',
  'movzx rax, al',
  'movsx rax, al',
  'lea rbx, [rax + 0x10]',
];

export const stackDemo = [
  'push rbp',
  'mov rbp, rsp',
  'sub rsp, 0x30',
];

export const stackFunctionDemo = [
  'push rbp',
  'mov rbp, rsp',
  'sub rsp, 0x20',
  'push rbx',
  'pop rbx',
  'mov rsp, rbp',
  'pop rbp',
  'ret',
];

export const arithmeticDemo = "mov rax, 0x7FFFFFFFFFFFFFFF\nadd rax, 1\nmov rcx, 10\ncmp rcx, 5\ntest rax, rax\nmov rbx, rax";

export const decompileDemo = "mov rax, 5\nadd rax, 3\nsub rax, 1\nimul rax, rax, 4\ncmp rax, 28\nmov rbx, rax";

export const controlFlowDemo: ControlFlowVisualizerProps = {
  nodes: [
    { id: 'start', label: 'START', code: ['mov eax, [rbp-4]'] },
    { id: 'cmp', label: 'CHECK', code: ['cmp eax, 1'] },
    { id: 'eq', label: 'FUNC A', code: ['call validate'] },
    { id: 'neq', label: 'FUNC B', code: ['call reject'] },
    { id: 'end', label: 'RET', code: ['ret'] },
  ],
  edges: [
    { from: 'start', to: 'cmp', type: 'unconditional' },
    { from: 'cmp', to: 'eq', label: '==1', type: 'taken' },
    { from: 'cmp', to: 'neq', label: '!=1', type: 'fallthrough' },
    { from: 'eq', to: 'end', type: 'unconditional' },
    { from: 'neq', to: 'end', type: 'unconditional' },
  ],
  startNodeId: 'start',
};

export const switchDemo: ControlFlowVisualizerProps = {
  nodes: [
    { id: 'entry', label: 'ENTRY', code: ['mov eax, [rbp-4]'] },
    { id: 'dispatch', label: 'DISPATCH', code: ['jmp [rax*8 + jt]'] },
    { id: 'c0', label: 'CASE 0', code: ['mov ecx, 0x100'] },
    { id: 'c1', label: 'CASE 1', code: ['mov ecx, 0x200'] },
    { id: 'c2', label: 'CASE 2', code: ['mov ecx, 0x300'] },
    { id: 'def', label: 'DEFAULT', code: ['xor ecx, ecx'] },
    { id: 'end', label: 'RET', code: ['ret'] },
  ],
  edges: [
    { from: 'entry', to: 'dispatch', type: 'unconditional' },
    { from: 'dispatch', to: 'c0', label: '=0', type: 'taken' },
    { from: 'dispatch', to: 'c1', label: '=1', type: 'taken' },
    { from: 'dispatch', to: 'c2', label: '=2', type: 'taken' },
    { from: 'dispatch', to: 'def', label: '>2', type: 'fallthrough' },
    { from: 'c0', to: 'end', type: 'unconditional' },
    { from: 'c1', to: 'end', type: 'unconditional' },
    { from: 'c2', to: 'end', type: 'unconditional' },
    { from: 'def', to: 'end', type: 'unconditional' },
  ],
  startNodeId: 'entry',
};

export const callGraphDemo: ControlFlowVisualizerProps = {
  nodes: [
    { id: 'main', label: 'main', code: ['call init'] },
    { id: 'init', label: 'init', code: ['call config'] },
    { id: 'config', label: 'config', code: ['lea rcx, [cfg]'] },
    { id: 'validate', label: 'validate', code: ['cmp eax, 0'] },
    { id: 'net', label: 'network', code: ['call send'] },
    { id: 'cleanup', label: 'cleanup', code: ['xor eax, eax'] },
  ],
  edges: [
    { from: 'main', to: 'init', type: 'unconditional' },
    { from: 'main', to: 'validate', type: 'unconditional' },
    { from: 'init', to: 'config', type: 'unconditional' },
    { from: 'validate', to: 'net', label: 'ok', type: 'taken' },
    { from: 'validate', to: 'cleanup', label: 'fail', type: 'fallthrough' },
    { from: 'net', to: 'cleanup', type: 'unconditional' },
  ],
  startNodeId: 'main',
};

export const breakpointProgram = {
  labels: { reject: 6, end: 7 },
  code: [
    { address: 0, op: 'mov', args: ['rax', '5'] },
    { address: 1, op: 'mov', args: ['rcx', '5'] },
    { address: 2, op: 'cmp', args: ['rax', 'rcx'] },
    { address: 3, op: 'jne', args: ['reject'] },
    { address: 4, op: 'mov', args: ['rdx', '1'] },
    { address: 5, op: 'jmp', args: ['end'] },
    { address: 6, op: 'mov', args: ['rdx', '0'] },
    { address: 7, op: 'ret', args: [] },
  ],
};

export const steppingProgram = {
  labels: { loop: 2 },
  code: [
    { address: 0, op: 'mov', args: ['rax', '0'] },
    { address: 1, op: 'mov', args: ['rcx', '3'] },
    { address: 2, op: 'add', args: ['rax', 'rcx'] },
    { address: 3, op: 'sub', args: ['rcx', '1'] },
    { address: 4, op: 'cmp', args: ['rcx', '0'] },
    { address: 5, op: 'jne', args: ['loop'] },
    { address: 6, op: 'ret', args: [] },
  ],
};

export const antidebugProgram = {
  labels: { detected: 5, end: 6 },
  code: [
    { address: 0, op: 'mov', args: ['rax', '1'] },
    { address: 1, op: 'test', args: ['rax', 'rax'] },
    { address: 2, op: 'jne', args: ['detected'] },
    { address: 3, op: 'mov', args: ['rcx', '0'] },
    { address: 4, op: 'jmp', args: ['end'] },
    { address: 5, op: 'mov', args: ['rcx', '1'] },
    { address: 6, op: 'ret', args: [] },
  ],
};

import type { InteractiveConfig, ControlFlowVisualizerProps } from '../types/interactive';

export const LESSON_SAMPLES: Record<string, InteractiveConfig> = {
  f1: { component: 'HexViewerIsland', props: { data: samplePE, mode: 'pe', highlightRanges: peHighlightRanges } },
  f2: { component: 'AssemblyVisualizerIsland', props: { instructions: registerDemo, title: 'Register State Machine' } },
  f3: { component: 'StackVisualizerIsland', props: { instructions: stackDemo, title: 'Stack Frame Explorer' } },
  f4: { component: 'HexViewerIsland', props: { data: samplePE, mode: 'pe', highlightRanges: peHighlightRanges } },
  a1: { component: 'AssemblyVisualizerIsland', props: { instructions: dataMovementDemo, title: 'Data Movement Playground' } },
  a2: { component: 'InstructionPlaygroundIsland', props: { initialCode: arithmeticDemo, title: 'Flag Explorer' } },
  a3: { component: 'ControlFlowVisualizerIsland', props: controlFlowDemo },
  a4: { component: 'StackVisualizerIsland', props: { instructions: stackFunctionDemo, title: 'Function Frame Explorer' } },
  a5: { component: 'ControlFlowVisualizerIsland', props: switchDemo },
  sa1: { component: 'HexViewerIsland', props: { data: stringsSampleHex, mode: 'raw', highlightRanges: stringsHighlightRanges } },
  sa2: { component: 'HexViewerIsland', props: { data: samplePE, mode: 'pe', highlightRanges: peHighlightRanges } },
  sa4: { component: 'ControlFlowVisualizerIsland', props: callGraphDemo },
  sa5: { component: 'InstructionPlaygroundIsland', props: { initialCode: decompileDemo, title: 'Decompiler Output' } },
  d1: { component: 'DebuggerSimulatorIsland', props: { ...breakpointProgram, title: 'Breakpoints' } },
  d2: { component: 'AssemblyVisualizerIsland', props: { instructions: registerDemo, title: 'Register Inspection' } },
  d3: { component: 'DebuggerSimulatorIsland', props: { ...steppingProgram, title: 'Stepping' } },
  d4: { component: 'DebuggerSimulatorIsland', props: { ...antidebugProgram, title: 'Anti-Debug Demo' } },
  w1: { component: 'HexViewerIsland', props: { data: samplePE, mode: 'pe', highlightRanges: peHighlightRanges } },
  w4: { component: 'HexViewerIsland', props: { data: samplePE, mode: 'pe', highlightRanges: peHighlightRanges } },
  w5: { component: 'HexViewerIsland', props: { data: samplePE, mode: 'pe', highlightRanges: peHighlightRanges } },
  m1: { component: 'HexViewerIsland', props: { data: malwareStringsHex, mode: 'raw' } },
  m4: { component: 'HexViewerIsland', props: { data: packedHex, mode: 'raw', highlightRanges: packedHighlightRanges } },
  e1: { component: 'StackVisualizerIsland', props: { instructions: stackFunctionDemo, title: 'Vulnerable Stack Frame' } },
  l1: { component: 'HexViewerIsland', props: { data: elfHex, mode: 'raw', highlightRanges: elfHighlightRanges } },
  ar1: { component: 'HexViewerIsland', props: { data: packedHex, mode: 'raw', highlightRanges: packedHighlightRanges } },
  ar3: { component: 'ControlFlowVisualizerIsland', props: controlFlowDemo },
  a6: { component: 'InstructionPlaygroundIsland', props: { initialCode: shiftDemo, title: 'Shift & Rotate Playground' } },
  a8: { component: 'HexViewerIsland', props: { data: instructionEncodingHex, mode: 'raw', highlightRanges: instructionEncodingHighlightRanges } },
};
