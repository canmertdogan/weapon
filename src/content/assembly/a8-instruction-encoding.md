---
id: a8
module: assembly
title: "Instruction Encoding"
order: 8
objectives:
  - "Break a raw instruction down into its REX prefix, opcode, ModRM, and immediate/displacement bytes"
  - "Explain what the ModRM byte's mod/reg/rm fields select"
  - "Explain why x86-64 is variable-length and what that means for disassembly"
  - "Read a REX prefix to determine 64-bit operand size and extended register access"
interactive: "HexViewer"
lab: ""
duration: 20
---

## Every Mnemonic Is a Byte Pattern

`ADD RAX, RBX` is the human-readable name. The CPU never sees that text — it sees `48 01 D8`. Every lesson in this module has been reading disassembly that a tool already decoded for you. This lesson works backward: given the raw bytes, reconstruct the instruction by hand. This is also exactly what makes the anti-disassembly tricks from later in the course (overlapping instructions, jump-into-the-middle) possible in the first place — they all exploit the fact that x86-64 instructions are variable-length and self-describing, not fixed-width and independently readable.

### The General Shape

```
[Prefixes]  Opcode  [ModRM]  [SIB]  [Displacement]  [Immediate]
 0-4 bytes  1-3 bytes  0-1     0-1    0, 1, or 4       0, 1, 2, 4, or 8
```

Nothing here is fixed-width. An instruction can be as short as one byte (`RET` = `C3`) or sprawl past 10 bytes with prefixes, a wide immediate, and a SIB byte all present. A disassembler has to decode each field in sequence to know how many bytes the *next* instruction even starts at — there's no way to jump to "the 5th instruction" without decoding the first four.

### The REX Prefix: Getting to 64-bit

Legacy x86 opcodes predate 64-bit registers entirely. The **REX prefix**, a single byte in the range `0x40`–`0x4F`, is what unlocks 64-bit operands and the extended register set (`R8`–`R15`):

```
0100 W R X B
```

- **W** (bit 3) — 1 means the operand size is 64-bit (this is exactly what makes `48` mean "this is the 64-bit version" in `add rax, rbx`).
- **R** — extends the ModRM `reg` field, giving access to `R8`–`R15` as a source/dest.
- **X** — extends the SIB `index` field.
- **B** — extends the ModRM `rm` field (or SIB `base`), giving access to `R8`–`R15` as the other operand.

No REX prefix at all means: 32-bit operands, and only the original eight registers (`RAX`–`RDI` equivalents) are reachable. This is why 32-bit code (`mov eax, ...`) is often one byte shorter than the identical 64-bit operation — no REX byte needed.

### ModRM: mod / reg / rm

Most instructions that touch a register or memory operand carry a **ModRM** byte, split into three fields:

```
mod (2 bits)   reg (3 bits)   rm (3 bits)
```

- **mod = 11** — both operands are registers (register-direct addressing).
- **mod = 00/01/10** — `rm` names a memory operand, with 0/1/4-byte displacement respectively (a SIB byte may follow if the addressing needs an index register or a non-RBP/R13 base).
- **reg** — usually the "other" operand (source or destination, depending on the opcode), or sometimes extends the opcode itself for single-operand instructions.
- **rm** — the primary operand, register or memory depending on `mod`.

### Three Worked Examples

The hex viewer below contains exactly these three instructions back to back — walk the highlighted fields to confirm the breakdown yourself.

**`add rax, rbx`** → `48 01 D8`
| Byte | Field | Value |
|------|-------|-------|
| `48` | REX | W=1 (64-bit), R=0, X=0, B=0 |
| `01` | Opcode | `ADD r/m64, r64` |
| `D8` | ModRM | mod=11 (reg-direct), reg=011 (`rbx`, source), rm=000 (`rax`, dest) |

**`mov eax, 0x12345678`** → `B8 78 56 34 12`
| Byte | Field | Value |
|------|-------|-------|
| `B8` | Opcode | `MOV eax, imm32` — note the destination register is encoded *in the opcode itself* (`B8` = `B8`+0 for `eax`), no ModRM needed |
| `78 56 34 12` | Immediate | `0x12345678`, stored **little-endian** — lowest byte first |

**`mov [rbp-8], eax`** → `89 45 F8`
| Byte | Field | Value |
|------|-------|-------|
| `89` | Opcode | `MOV r/m32, r32` |
| `45` | ModRM | mod=01 (1-byte displacement), reg=000 (`eax`, source), rm=101 (`rbp`-relative) |
| `F8` | Displacement | `0xF8` = `-8` as a signed byte |

That last example is worth sitting with: no REX prefix (32-bit operands, plain `eax`), an 8-bit displacement because `-8` fits in one signed byte, and the whole "local variable at `rbp-8`" pattern from [Stack & Functions](/course/assembly/a4) collapses to three bytes.

### Why This Matters Beyond Trivia

A **linear disassembler** reads bytes strictly in file order, decoding one instruction and then starting the next wherever the previous one ended. A **recursive/flow-aware disassembler** instead follows actual jump and call targets. They normally agree — but an attacker who deliberately places a stray byte that a linear sweep decodes as part of the *previous* instruction, while a real jump target lands one byte later, can make the two disassemblers disagree completely about what code is actually there. That trick only works because you now know the mechanism it's abusing: variable length, and no way to know an instruction's boundaries without decoding everything before it.

## Interactive: Encoding Explorer

Walk the highlighted bytes field by field — REX prefix, opcode, ModRM, immediate, and displacement — for all three worked examples above.

## Takeaway

> A mnemonic is just a human-readable label for a byte pattern. Once you can decode `48 01 D8` by hand, "the disassembler must be wrong" stops being your first guess and starts being something you can actually check.

Next: **Static Analysis** — strings, imports, functions, and cross references.
