---
id: f2
module: foundations
title: "CPU Fundamentals"
order: 2
objectives:
  - Understand the register model (GPRs, RIP, RFLAGS)
  - Explain the fetch-decode-execute cycle
  - Distinguish CISC vs RISC, understand x86-64 as CISC
  - Identify instruction encoding basics (prefixes, opcode, ModR/M, SIB, displacement, immediate)
interactive: "AssemblyVisualizer"
lab: ""
duration: 20
---

The CPU is a **state machine**. Registers hold state. Instructions transition state.

## x86-64 Register Model

### General Purpose Registers (64-bit)

| 64-bit | 32-bit | 16-bit | 8-bit (low) | 8-bit (high) | Conventional Role |
|--------|--------|--------|-------------|--------------|-------------------|
| RAX | EAX | AX | AL | AH | Return value, accumulator |
| RBX | EBX | BX | BL | BH | General-purpose (callee-saved) |
| RCX | ECX | CX | CL | CH | Loop counter, 1st arg (Win64) |
| RDX | EDX | DX | DL | DH | 2nd arg (Win64), I/O |
| RSI | ESI | SI | SIL | — | Source index, 2nd arg (SysV) |
| RDI | EDI | DI | DIL | — | Dest index, 1st arg (SysV) |
| RBP | EBP | BP | BPL | — | Frame pointer (callee-saved) |
| RSP | ESP | SP | SPL | — | Stack pointer |
| R8–R11 | R8D–R11D | R8W–R11W | R8B–R11B | — | Additional GPRs (volatile) |
| R12–R15 | R12D–R15D | R12W–R15W | R12B–R15B | — | Additional GPRs (callee-saved) |

### Special Registers

| Register | Purpose |
|----------|---------|
| **RIP** | Instruction Pointer — address of *next* instruction |
| **RFLAGS** | Status flags (ZF, CF, SF, OF, PF, AF, DF, IF, TF, etc.) |

### RFLAGS Bits You'll Actually Read

| Flag | Bit | Name | Set When |
|------|-----|------|----------|
| **ZF** | 6 | Zero Flag | Result == 0 |
| **CF** | 0 | Carry Flag | Unsigned overflow / borrow |
| **SF** | 7 | Sign Flag | Result MSB = 1 (negative) |
| **OF** | 11 | Overflow Flag | Signed overflow |
| **PF** | 2 | Parity Flag | Low byte has even parity |
| **AF** | 4 | Adjust Flag | BCD carry (rare) |

## Fetch-Decode-Execute Cycle

```
while (true) {
  instruction = memory[RIP];     // FETCH
  decoded = decode(instruction); // DECODE
  execute(decoded);              // EXECUTE
  RIP += instruction.length;     // ADVANCE (unless branch)
}
```

**Key insight**: `RIP` *always* points to the next instruction. `CALL`/`JMP` modify `RIP` directly.

## Instruction Encoding (x86-64)

```
[Prefixes] [REX] [Opcode] [ModR/M] [SIB] [Displacement] [Immediate]
   0-4B       1B     1-3B      1B      1B       0-4B          0-4B
```

- **Prefixes**: `REP`, `LOCK`, operand-size, address-size, segment override
- **REX**: Extends registers to R8-R15, 64-bit operand size
- **Opcode**: The actual operation (1-3 bytes)
- **ModR/M**: Encodes operands (register/memory, register)
- **SIB**: Scale-Index-Base for complex addressing `[base + index*scale + disp]`
- **Displacement**: Memory offset (8/32-bit)
- **Immediate**: Literal value in instruction

## Interactive: Register State Machine


**Try it**: Step through `mov rax, 5` → `add rax, 3` → `sub rax, 1`. Watch RAX change, RIP advance, flags update.

## Calling Conventions (Preview)

| Convention | 1st Arg | 2nd Arg | 3rd Arg | 4th Arg | Return | Volatile | Preserved |
|------------|---------|---------|---------|---------|--------|----------|-----------|
| **Win64** | RCX | RDX | R8 | R9 | RAX | RCX,RDX,R8-R11 | RBX,RBP,RDI,RSI,R12-R15 |
| **SysV AMD64** | RDI | RSI | RDX | RCX | RAX | RAX,RCX,RDX,R8-R11 | RBX,RBP,R12-R15 |

**Stack shadow space**: Win64 reserves 32 bytes (`4*8`) above return address for callees to spill register args.

## Takeaway

> Registers are the CPU's scratchpad. Instructions are state transitions. Flags are the receipts.

Next: **Memory Layout** — where the stack lives, how the heap grows, and why ASLR exists.