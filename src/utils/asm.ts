export type RegisterName =
  | 'rax' | 'rbx' | 'rcx' | 'rdx'
  | 'rsi' | 'rdi' | 'rbp' | 'rsp'
  | 'r8' | 'r9' | 'r10' | 'r11'
  | 'r12' | 'r13' | 'r14' | 'r15'
  | 'rip' | 'rflags';

export type FlagName = 'CF' | 'PF' | 'AF' | 'ZF' | 'SF' | 'TF' | 'IF' | 'DF' | 'OF';

export interface Flags {
  CF: boolean;
  PF: boolean;
  AF: boolean;
  ZF: boolean;
  SF: boolean;
  TF: boolean;
  IF: boolean;
  DF: boolean;
  OF: boolean;
}

export interface CPUState {
  regs: Record<RegisterName, bigint>;
  flags: Flags;
  memory: Uint8Array;
  stackTop: number;
}

export const GP_REGISTERS: RegisterName[] = [
  'rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'rbp', 'rsp',
  'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15',
];

export const REGISTER_ALIASES: Record<string, RegisterName> = {
  rax: 'rax', eax: 'rax', ax: 'rax', al: 'rax', ah: 'rax',
  rbx: 'rbx', ebx: 'rbx', bx: 'rbx', bl: 'rbx', bh: 'rbx',
  rcx: 'rcx', ecx: 'rcx', cx: 'rcx', cl: 'rcx', ch: 'rcx',
  rdx: 'rdx', edx: 'rdx', dx: 'rdx', dl: 'rdx', dh: 'rdx',
  rsi: 'rsi', esi: 'rsi', si: 'rsi', sil: 'rsi',
  rdi: 'rdi', edi: 'rdi', di: 'rdi', dil: 'rdi',
  rbp: 'rbp', ebp: 'rbp', bp: 'rbp', bpl: 'rbp',
  rsp: 'rsp', esp: 'rsp', sp: 'rsp', spl: 'rsp',
  r8: 'r8', r8d: 'r8', r8w: 'r8', r8b: 'r8',
  r9: 'r9', r9d: 'r9', r9w: 'r9', r9b: 'r9',
  r10: 'r10', r10d: 'r10', r10w: 'r10', r10b: 'r10',
  r11: 'r11', r11d: 'r11', r11w: 'r11', r11b: 'r11',
  r12: 'r12', r12d: 'r12', r12w: 'r12', r12b: 'r12',
  r13: 'r13', r13d: 'r13', r13w: 'r13', r13b: 'r13',
  r14: 'r14', r14d: 'r14', r14w: 'r14', r14b: 'r14',
  r15: 'r15', r15d: 'r15', r15w: 'r15', r15b: 'r15',
  rip: 'rip', eip: 'rip',
  rflags: 'rflags', flags: 'rflags', eflags: 'rflags',
};

export function registerBitWidth(name: string): number {
  const n = name.toLowerCase();
  if (/^[abcd]h$/.test(n)) return 8;
  if (/^[abcd]l$/.test(n) || /^spl$/.test(n) || /^bpl$/.test(n) || /^dil$/.test(n) || /^sil$/.test(n)) return 8;
  if (/^r\d+b$/.test(n)) return 8;
  if (/^r\d+w$/.test(n)) return 16;
  if (/^r\d+d$/.test(n)) return 32;
  if (/^e(ax|bx|cx|dx|si|di|bp|sp|ip|flags)$/.test(n)) return 32;
  if (/^r[a-z0-9]+$/.test(n) && !/^r\d{1,2}$/.test(n) && !/^rip$/.test(n)) return 64;
  if (/^r\d{1,2}$/.test(n)) return 64;
  if (/^(ax|bx|cx|dx|si|di|bp|sp|ip)$/.test(n)) return 16;
  if (n === 'rip') return 64;
  if (n === 'rflags' || n === 'flags' || n === 'eflags') return 64;
  return 64;
}

const MASK64 = (1n << 64n) - 1n;

export function createCPUState(memorySize: number = 4096, stackTop: number = 0): CPUState {
  const regs = {} as Record<RegisterName, bigint>;
  GP_REGISTERS.forEach((r) => (regs[r] = 0n));
  regs.rip = 0n;
  regs.rflags = 0x202n; // IF set by default
  regs.rsp = BigInt(stackTop);
  return {
    regs,
    flags: { CF: false, PF: false, AF: false, ZF: false, SF: false, TF: false, IF: true, DF: false, OF: false },
    memory: new Uint8Array(memorySize),
    stackTop,
  };
}

export function readRegister(state: CPUState, name: string): bigint {
  const alias = REGISTER_ALIASES[name] || 'rax';
  const full = state.regs[alias];
  const width = registerBitWidth(name);
  const mask = (1n << BigInt(width)) - 1n;
  // Handle high-byte registers (ah, bh, ch, dh)
  if (/^[abcd]h$/.test(name)) {
    return (full >> 8n) & 0xffn;
  }
  return full & mask;
}

export function writeRegister(state: CPUState, name: string, value: bigint): void {
  const alias = REGISTER_ALIASES[name] || 'rax';
  const width = registerBitWidth(name);
  value &= (1n << BigInt(width)) - 1n;

  // High-byte register
  if (/^[abcd]h$/.test(name)) {
    const shifted = value << 8n;
    const mask = ~(0xffn << 8n) & MASK64;
    state.regs[alias] = (state.regs[alias] & mask) | shifted;
    return;
  }

  // Writing a 32-bit register zero-extends to 64 bits (x86-64 rule)
  if (width === 32) {
    state.regs[alias] = value;
    return;
  }

  // Otherwise preserve upper bits
  const mask = (1n << BigInt(width)) - 1n;
  state.regs[alias] = (state.regs[alias] & ~mask) | value;
}

function parseImmediate(str: string): bigint {
  str = str.trim();
  if (str.startsWith('0x') || str.startsWith('0X')) {
    return BigInt(str);
  }
  if (/^\d+$/.test(str)) {
    return BigInt(str);
  }
  if (/^[01]+b$/i.test(str)) {
    return BigInt('0b' + str.slice(0, -1));
  }
  throw new Error(`Cannot parse immediate: ${str}`);
}

export interface DecodedInstruction {
  op: string;
  operands: string[];
}

export function tokenize(line: string): DecodedInstruction | null {
  const trimmed = line.trim().replace(/;.*$/, '').trim();
  if (!trimmed) return null;

  // Split on whitespace/commas, but keep bracketed expressions intact.
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if ((ch === ' ' || ch === '\t' || ch === ',') && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  return { op: parts[0].toLowerCase(), operands: parts.slice(1).map((p) => p.toLowerCase()) };
}

export interface StepResult {
  state: CPUState;
  changedRegs: Set<RegisterName>;
  changedFlags: Set<FlagName>;
  taken: boolean;
  nextRip: bigint;
}

export function execute(state: CPUState, line: string): StepResult {
  const dec = tokenize(line);
  if (!dec) throw new Error('Empty instruction');

  const changedRegs = new Set<RegisterName>();
  const changedFlags = new Set<FlagName>();
  let taken = false;
  const nextRip = BigInt(-1);

  const op = dec.op;
  const o = dec.operands;

  const result = { state, changedRegs, changedFlags, taken, nextRip };

  switch (op) {
    case 'mov': {
      const dst = o[0];
      const src = o[1];
      const value = isRegister(src) ? readRegister(state, src) : parseImmediate(src);
      writeRegister(state, dst, value);
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'movzx': {
      const dst = o[0];
      const src = o[1];
      const value = readRegister(state, src);
      writeRegister(state, dst, value);
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'movsx': {
      const dst = o[0];
      const src = o[1];
      let value = readRegister(state, src);
      const srcWidth = registerBitWidth(src);
      const signBit = 1n << BigInt(srcWidth - 1);
      if (value & signBit) {
        value = value | (MASK64 ^ ((1n << BigInt(srcWidth)) - 1n));
      }
      writeRegister(state, dst, value);
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'lea': {
      const dst = o[0];
      const expr = o[1];
      const value = evalEffectiveAddress(state, expr);
      writeRegister(state, dst, value);
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'add': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const b = isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1]);
      const width = registerBitWidth(dst);
      const sum = (a + b) & ((1n << BigInt(width)) - 1n);
      writeRegister(state, dst, sum);
      updateArithFlags(state, a, b, sum, width, true);
      changedRegs.add(REGISTER_ALIASES[dst]);
      changedFlags.add('CF'); changedFlags.add('ZF'); changedFlags.add('SF'); changedFlags.add('OF');
      break;
    }
    case 'sub': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const b = isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1]);
      const width = registerBitWidth(dst);
      const diff = (a - b) & ((1n << BigInt(width)) - 1n);
      writeRegister(state, dst, diff);
      updateArithFlags(state, a, b, diff, width, false);
      changedRegs.add(REGISTER_ALIASES[dst]);
      changedFlags.add('CF'); changedFlags.add('ZF'); changedFlags.add('SF'); changedFlags.add('OF');
      break;
    }
    case 'inc': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const width = registerBitWidth(dst);
      const v = (a + 1n) & ((1n << BigInt(width)) - 1n);
      writeRegister(state, dst, v);
      setZF(state, v, width);
      setSF(state, v, width);
      setOF(state, a, 1n, v, width, true);
      changedRegs.add(REGISTER_ALIASES[dst]);
      changedFlags.add('ZF'); changedFlags.add('SF'); changedFlags.add('OF');
      break;
    }
    case 'dec': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const width = registerBitWidth(dst);
      const v = (a - 1n) & ((1n << BigInt(width)) - 1n);
      writeRegister(state, dst, v);
      setZF(state, v, width);
      setSF(state, v, width);
      setOF(state, a, 1n, v, width, false);
      changedRegs.add(REGISTER_ALIASES[dst]);
      changedFlags.add('ZF'); changedFlags.add('SF'); changedFlags.add('OF');
      break;
    }
    case 'imul': {
      const dst = o[0];
      if (o.length === 2) {
        const a = readRegister(state, dst);
        const b = isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1]);
        const width = registerBitWidth(dst);
        const v = (a * b) & ((1n << BigInt(width)) - 1n);
        writeRegister(state, dst, v);
        setZF(state, v, width);
        setSF(state, v, width);
      } else if (o.length === 3) {
        const b = isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1]);
        const c = isRegister(o[2]) ? readRegister(state, o[2]) : parseImmediate(o[2]);
        const width = registerBitWidth(dst);
        const v = (b * c) & ((1n << BigInt(width)) - 1n);
        writeRegister(state, dst, v);
        setZF(state, v, width);
        setSF(state, v, width);
      }
      changedRegs.add(REGISTER_ALIASES[dst]);
      changedFlags.add('ZF'); changedFlags.add('SF');
      break;
    }
    case 'neg': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const width = registerBitWidth(dst);
      const v = (-a) & ((1n << BigInt(width)) - 1n);
      writeRegister(state, dst, v);
      state.flags.CF = a !== 0n;
      setZF(state, v, width);
      setSF(state, v, width);
      state.flags.OF = a === (1n << BigInt(width - 1));
      changedRegs.add(REGISTER_ALIASES[dst]);
      changedFlags.add('CF'); changedFlags.add('ZF'); changedFlags.add('SF'); changedFlags.add('OF');
      break;
    }
    case 'and': case 'or': case 'xor': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const b = isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1]);
      const width = registerBitWidth(dst);
      let v: bigint;
      if (op === 'and') v = a & b;
      else if (op === 'or') v = a | b;
      else v = a ^ b;
      v &= (1n << BigInt(width)) - 1n;
      writeRegister(state, dst, v);
      state.flags.CF = false;
      state.flags.OF = false;
      state.flags.AF = false;
      setZF(state, v, width);
      setSF(state, v, width);
      setPF(state, v);
      changedRegs.add(REGISTER_ALIASES[dst]);
      changedFlags.add('CF'); changedFlags.add('OF'); changedFlags.add('ZF'); changedFlags.add('SF');
      break;
    }
    case 'not': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const width = registerBitWidth(dst);
      const v = (~a) & ((1n << BigInt(width)) - 1n);
      writeRegister(state, dst, v);
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'test': {
      const a = readRegister(state, o[0]);
      const b = isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1]);
      const width = registerBitWidth(o[0]);
      const v = a & b;
      state.flags.CF = false;
      state.flags.OF = false;
      state.flags.AF = false;
      setZF(state, v, width);
      setSF(state, v, width);
      setPF(state, v);
      changedFlags.add('CF'); changedFlags.add('OF'); changedFlags.add('ZF'); changedFlags.add('SF');
      break;
    }
    case 'cmp': {
      const a = readRegister(state, o[0]);
      const b = isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1]);
      const width = registerBitWidth(o[0]);
      const diff = (a - b) & ((1n << BigInt(width)) - 1n);
      updateArithFlags(state, a, b, diff, width, false);
      changedFlags.add('CF'); changedFlags.add('ZF'); changedFlags.add('SF'); changedFlags.add('OF');
      break;
    }
    case 'push': {
      const value = isRegister(o[0]) ? readRegister(state, o[0]) : parseImmediate(o[0]);
      state.regs.rsp -= 8n;
      writeMemory64(state, Number(state.regs.rsp), value);
      changedRegs.add('rsp');
      break;
    }
    case 'pop': {
      const value = readMemory64(state, Number(state.regs.rsp));
      state.regs.rsp += 8n;
      writeRegister(state, o[0], value);
      changedRegs.add('rsp');
      changedRegs.add(REGISTER_ALIASES[o[0]]);
      break;
    }
    case 'jmp': {
      result.taken = true;
      if (o[0].startsWith('0x') || /^\d+$/.test(o[0])) {
        result.nextRip = parseImmediate(o[0]);
      }
      break;
    }
    case 'je': case 'jz': case 'jne': case 'jnz':
    case 'ja': case 'jnbe': case 'jae': case 'jnb':
    case 'jb': case 'jnae': case 'jbe': case 'jna':
    case 'jg': case 'jnle': case 'jge': case 'jnl':
    case 'jl': case 'jnge': case 'jle': case 'jng': {
      result.taken = evalCondition(op, state.flags);
      if (result.taken && (o[0].startsWith('0x') || /^\d+$/.test(o[0]))) {
        result.nextRip = parseImmediate(o[0]);
      }
      break;
    }
    case 'shl': case 'sal': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const width = registerBitWidth(dst);
      const countMask = width > 32 ? 0x3fn : 0x1fn;
      const count = (isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1])) & countMask;
      const mask = (1n << BigInt(width)) - 1n;
      const v = count === 0n ? a : (a << count) & mask;
      writeRegister(state, dst, v);
      if (count > 0n) {
        const lastOutBit = (width - Number(count) >= 0 && width - Number(count) < width)
          ? (a >> BigInt(width - Number(count))) & 1n
          : 0n;
        state.flags.CF = lastOutBit === 1n;
        if (count === 1n) state.flags.OF = ((v >> BigInt(width - 1)) & 1n) !== (state.flags.CF ? 1n : 0n);
        setZF(state, v, width);
        setSF(state, v, width);
        setPF(state, v);
        changedFlags.add('CF'); changedFlags.add('OF'); changedFlags.add('ZF'); changedFlags.add('SF'); changedFlags.add('PF');
      }
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'shr': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const width = registerBitWidth(dst);
      const countMask = width > 32 ? 0x3fn : 0x1fn;
      const count = (isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1])) & countMask;
      const mask = (1n << BigInt(width)) - 1n;
      const v = count === 0n ? a : (a & mask) >> count;
      writeRegister(state, dst, v);
      if (count > 0n) {
        const lastOutBit = count <= BigInt(width) ? (a >> (count - 1n)) & 1n : 0n;
        state.flags.CF = lastOutBit === 1n;
        if (count === 1n) state.flags.OF = ((a >> BigInt(width - 1)) & 1n) === 1n;
        setZF(state, v, width);
        setSF(state, v, width);
        setPF(state, v);
        changedFlags.add('CF'); changedFlags.add('OF'); changedFlags.add('ZF'); changedFlags.add('SF'); changedFlags.add('PF');
      }
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'sar': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const width = registerBitWidth(dst);
      const countMask = width > 32 ? 0x3fn : 0x1fn;
      const count = (isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1])) & countMask;
      const mask = (1n << BigInt(width)) - 1n;
      const signBit = (a >> BigInt(width - 1)) & 1n;
      let v: bigint;
      if (count === 0n) {
        v = a;
      } else if (count >= BigInt(width)) {
        v = signBit === 1n ? mask : 0n;
      } else {
        v = a >> count;
        if (signBit === 1n) {
          const signExtend = mask & ~((1n << (BigInt(width) - count)) - 1n);
          v |= signExtend;
        }
      }
      writeRegister(state, dst, v);
      if (count > 0n) {
        const lastOutBit = count <= BigInt(width) ? (a >> (count - 1n)) & 1n : signBit;
        state.flags.CF = lastOutBit === 1n;
        if (count === 1n) state.flags.OF = false;
        setZF(state, v, width);
        setSF(state, v, width);
        setPF(state, v);
        changedFlags.add('CF'); changedFlags.add('OF'); changedFlags.add('ZF'); changedFlags.add('SF'); changedFlags.add('PF');
      }
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'rol': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const width = registerBitWidth(dst);
      const countMask = width > 32 ? 0x3fn : 0x1fn;
      const rawCount = (isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1])) & countMask;
      const count = rawCount % BigInt(width);
      const mask = (1n << BigInt(width)) - 1n;
      const v = count === 0n ? a : (((a << count) | (a >> (BigInt(width) - count))) & mask);
      writeRegister(state, dst, v);
      if (rawCount > 0n) {
        state.flags.CF = (v & 1n) === 1n;
        if (rawCount === 1n) state.flags.OF = ((v >> BigInt(width - 1)) & 1n) !== (v & 1n);
        changedFlags.add('CF'); changedFlags.add('OF');
      }
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'ror': {
      const dst = o[0];
      const a = readRegister(state, dst);
      const width = registerBitWidth(dst);
      const countMask = width > 32 ? 0x3fn : 0x1fn;
      const rawCount = (isRegister(o[1]) ? readRegister(state, o[1]) : parseImmediate(o[1])) & countMask;
      const count = rawCount % BigInt(width);
      const mask = (1n << BigInt(width)) - 1n;
      const v = count === 0n ? a : (((a >> count) | (a << (BigInt(width) - count))) & mask);
      writeRegister(state, dst, v);
      if (rawCount > 0n) {
        state.flags.CF = ((v >> BigInt(width - 1)) & 1n) === 1n;
        if (rawCount === 1n) state.flags.OF = ((v >> BigInt(width - 1)) & 1n) !== ((v >> BigInt(width - 2)) & 1n);
        changedFlags.add('CF'); changedFlags.add('OF');
      }
      changedRegs.add(REGISTER_ALIASES[dst]);
      break;
    }
    case 'bsf': {
      const dst = o[0];
      const src = readRegister(state, o[1]);
      const width = registerBitWidth(o[1]);
      if (src === 0n) {
        state.flags.ZF = true;
      } else {
        let idx = 0;
        let v = src;
        while ((v & 1n) === 0n) { v >>= 1n; idx++; }
        writeRegister(state, dst, BigInt(idx));
        state.flags.ZF = false;
        changedRegs.add(REGISTER_ALIASES[dst]);
      }
      changedFlags.add('ZF');
      break;
    }
    case 'bsr': {
      const dst = o[0];
      const src = readRegister(state, o[1]);
      const width = registerBitWidth(o[1]);
      if (src === 0n) {
        state.flags.ZF = true;
      } else {
        let idx = width - 1;
        while (idx > 0 && ((src >> BigInt(idx)) & 1n) === 0n) idx--;
        writeRegister(state, dst, BigInt(idx));
        state.flags.ZF = false;
        changedRegs.add(REGISTER_ALIASES[dst]);
      }
      changedFlags.add('ZF');
      break;
    }
    case 'popcnt': {
      const dst = o[0];
      const src = readRegister(state, o[1]);
      const width = registerBitWidth(o[1]);
      let count = 0n;
      for (let i = 0; i < width; i++) {
        if ((src >> BigInt(i)) & 1n) count++;
      }
      writeRegister(state, dst, count);
      state.flags.CF = false;
      state.flags.OF = false;
      state.flags.SF = false;
      state.flags.AF = false;
      state.flags.PF = false;
      state.flags.ZF = count === 0n;
      changedRegs.add(REGISTER_ALIASES[dst]);
      changedFlags.add('CF'); changedFlags.add('OF'); changedFlags.add('SF'); changedFlags.add('AF'); changedFlags.add('PF'); changedFlags.add('ZF');
      break;
    }
    case 'nop':
      break;
    case 'ret':
      result.taken = true;
      break;
    default:
      throw new Error(`Unsupported instruction: ${op}`);
  }

  return result;
}

function isRegister(name: string): boolean {
  return name in REGISTER_ALIASES;
}

function evalEffectiveAddress(state: CPUState, expr: string): bigint {
  // Support [rbx + rcx*4 + 0x10] and [rax + 0x10] and [rax]
  let inner = expr.trim();
  if (inner.startsWith('[') && inner.endsWith(']')) {
    inner = inner.slice(1, -1);
  }
  let sum = 0n;
  const terms = inner.split('+').map((t) => t.trim()).filter(Boolean);
  for (const term of terms) {
    // term could be reg*scale
    const mult = term.split('*').map((t) => t.trim());
    if (mult.length === 2) {
      const base = isRegister(mult[0]) ? readRegister(state, mult[0]) : 0n;
      const scale = parseImmediate(mult[1]);
      sum += base * scale;
    } else {
      if (isRegister(mult[0])) {
        sum += readRegister(state, mult[0]);
      } else {
        sum += parseImmediate(mult[0]);
      }
    }
  }
  return sum;
}

function setZF(state: CPUState, v: bigint, width: number): void {
  state.flags.ZF = (v & ((1n << BigInt(width)) - 1n)) === 0n;
}

function setSF(state: CPUState, v: bigint, width: number): void {
  state.flags.SF = (v & (1n << BigInt(width - 1))) !== 0n;
}

function setPF(state: CPUState, v: bigint): void {
  const low = Number(v & 0xffn);
  let count = 0;
  for (let i = 0; i < 8; i++) if (low & (1 << i)) count++;
  state.flags.PF = count % 2 === 0;
}

function setOF(state: CPUState, a: bigint, b: bigint, result: bigint, width: number, isAdd: boolean): void {
  const signA = a >> BigInt(width - 1);
  const signB = isAdd ? b >> BigInt(width - 1) : (b >> BigInt(width - 1)) ^ 1n;
  const signR = result >> BigInt(width - 1);
  state.flags.OF = signA === signB && signA !== signR;
}

function updateArithFlags(state: CPUState, a: bigint, b: bigint, result: bigint, width: number, isAdd: boolean): void {
  const mask = (1n << BigInt(width)) - 1n;
  if (isAdd) {
    state.flags.CF = (a + b) > mask;
  } else {
    state.flags.CF = a < b;
  }
  state.flags.ZF = (result & mask) === 0n;
  state.flags.SF = (result & (1n << BigInt(width - 1))) !== 0n;
  setOF(state, a, b, result, width, isAdd);
  setPF(state, result);
}

function evalCondition(op: string, flags: Flags): boolean {
  switch (op) {
    case 'je': case 'jz': return flags.ZF;
    case 'jne': case 'jnz': return !flags.ZF;
    case 'ja': case 'jnbe': return !flags.CF && !flags.ZF;
    case 'jae': case 'jnb': return !flags.CF;
    case 'jb': case 'jnae': return flags.CF;
    case 'jbe': case 'jna': return flags.CF || flags.ZF;
    case 'jg': case 'jnle': return !flags.ZF && flags.SF === flags.OF;
    case 'jge': case 'jnl': return flags.SF === flags.OF;
    case 'jl': case 'jnge': return flags.SF !== flags.OF;
    case 'jle': case 'jng': return flags.ZF || flags.SF !== flags.OF;
    default: return false;
  }
}

function writeMemory64(state: CPUState, addr: number, value: bigint): void {
  for (let i = 0; i < 8; i++) {
    state.memory[addr + i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
}

function readMemory64(state: CPUState, addr: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) {
    value = (value << 8n) | BigInt(state.memory[addr + i]);
  }
  return value;
}
