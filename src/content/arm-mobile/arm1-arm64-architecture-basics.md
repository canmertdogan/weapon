---
id: arm1
module: arm-mobile
title: "ARM64 Architecture Basics"
order: 1
objectives:
  - "Map the AArch64 register set: X0-X30, SP, PC, and the XZR zero register"
  - "Contrast ARM's fixed-width load/store instruction model with x86's variable-length CISC model"
  - "Read basic ARM64 mnemonics: mov, add, ldr, str, b, bl"
  - "Distinguish A64 (64-bit) from Thumb/A32 (32-bit legacy) encoding at a conceptual level"
interactive: ""
lab: ""
duration: 20
---

## A Different Machine, the Same Job

ARM64 (AArch64) runs most phones, tablets, and a growing share of laptops and servers. The mental model you built for x86 still applies — registers, a stack, a program counter — but the instruction set is a deliberately different design, and that difference shapes every disassembly you'll read.

### The Register File

AArch64 gives you 31 general-purpose 64-bit registers, `X0` through `X30`, plus two special ones:

```
X0-X7    argument / result registers (see arm2 for the calling convention)
X8-X17   temporary / indirect-result registers
X18      platform register (reserved on some ABIs)
X19-X28  callee-saved registers
X29      frame pointer (FP)
X30      link register (LR) — holds the return address
SP       stack pointer (not a numbered X register)
PC       program counter (not directly writable by most instructions)
```

Each `Xn` has a 32-bit alias `Wn` — the low 32 bits of the same physical register. `mov w0, #5` zero-extends into the upper half of `X0`. It's the same idea as `EAX` being the low 32 bits of `RAX` on x86, just applied uniformly across all 31 registers instead of a handful of legacy ones.

One more oddity: register index 31 isn't a real register. Depending on the instruction, it means either `SP` or `XZR`/`WZR` — a hardwired zero register that silently discards writes and always reads as `0`. Comparisons and "move to nowhere" idioms (`cmp` is literally `subs xzr, ...`) lean on this constantly.

### Load/Store: Memory Is Not an Operand

This is the single most important shift coming from x86. x86 lets almost any instruction touch memory directly — `add [rbx], eax`, `mov [rsp+8], rcx`. ARM64 does not. It's a **load/store architecture**: arithmetic and logic instructions only ever operate on registers, and memory is reachable exclusively through explicit `ldr` (load register) and `str` (store register) instructions.

```
ldr x0, [x1]        ; X0 = memory at address in X1
str x0, [x1]        ; memory at address in X1 = X0
add x0, x0, x1       ; X0 = X0 + X1 (registers only, no memory operand)
```

Every memory access in a disassembly is visibly an `ldr`/`str` — you never have to guess whether an `add` secretly touched RAM. That regularity is also why ARM decode logic is simpler and pipelines more predictably than x86's.

### Fixed-Width Encoding

Every A64 instruction is exactly 4 bytes, always aligned. Contrast that with x86-64 (covered in `/course/assembly/a1`), where an instruction can run from 1 to 15 bytes depending on prefixes, opcode, and operand encoding. Fixed width means a disassembler never has to resync after a bad guess, and jump tables can be indexed by instruction count instead of scanned byte-by-byte — but it also means ARM64 can't pack an immediate value larger than it can fit in the remaining encoding bits into a single instruction, hence idioms like `movz`/`movk` pairs to build a 64-bit constant.

### Core Mnemonics, With x86 in Mind

| ARM64 | Effect | Rough x86-64 equivalent |
|-------|--------|--------------------------|
| `mov x0, #5` | X0 = 5 | `mov rax, 5` |
| `add x0, x1, x2` | X0 = X1 + X2 | `lea rax, [rcx+rdx]` |
| `ldr x0, [x1]` | X0 = *X1 | `mov rax, [rcx]` |
| `str x0, [x1]` | *X1 = X0 | `mov [rcx], rax` |
| `b label` | unconditional jump | `jmp label` |
| `bl label` | call, saves return addr in X30 | `call label` |

Note `add` takes three operands — destination, then two sources — where x86's two-operand form overwrites one input. ARM64's three-operand encoding is another consequence of the fixed instruction width: there's room for a clean destination register instead of forcing a read-modify-write on one operand.

### A32 and Thumb: the 32-bit Legacy

Older and embedded ARM cores also support **A32** (classic 32-bit ARM, still 4-byte fixed instructions) and **Thumb** (a compressed 16-bit encoding of a subset of the instruction set, with Thumb-2 mixing in some 32-bit instructions for density). You'll mostly meet these in older Android native libraries or firmware, not modern 64-bit apps. The key conceptual point: A64 is a clean, single instruction width; A32/Thumb is the pre-AArch64 world where a CPU could switch encoding modes mid-execution, which itself became a source of exploit and obfuscation tricks. Modern iOS and 64-bit Android are A64-only, which is why this module focuses there.

## Takeaway

> ARM64 trades x86's memory-anywhere flexibility for load/store regularity and fixed 4-byte instructions — read the `ldr`/`str` boundary and the rest of the disassembly falls into place.
