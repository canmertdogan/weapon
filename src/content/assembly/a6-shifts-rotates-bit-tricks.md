---
id: a6
module: assembly
title: "Shifts, Rotates & Bit Tricks"
order: 6
objectives:
  - "Execute SHL/SHR/SAL/SAR and predict both the result and the carry flag"
  - "Distinguish logical (SHR) from arithmetic (SAR) right shift and know when a compiler picks each"
  - "Use ROL/ROR for bit rotation and recognize them inside hashing and crypto code"
  - "Use BT/BSF/BSR/POPCNT to test, find, and count bits without writing a loop"
interactive: "InstructionPlayground"
lab: ""
duration: 20
---

## Beyond Addition: Moving and Counting Bits

`ADD`/`SUB` and `AND`/`OR`/`XOR` from the last two lessons cover most arithmetic and logic. This lesson covers the instructions compilers reach for once the operation is really about *bit position* — multiplying by powers of two, extracting a bitfield, hashing, or asking "which bit is set" without a loop.

### SHL / SHR — Logical Shifts

```asm
shl rax, 4          ; rax <<= 4  (multiply by 16)
shr rax, 4          ; rax >>= 4  (unsigned divide by 16)
```

Both shift zeros into the vacated bits. The **last bit shifted out lands in CF** — `shl rax, 1; jc overflow` is a real pattern for detecting an unsigned doubling that lost a bit. `SAL` is just an alias for `SHL`; you'll see the disassembler print one or the other but they're the same opcode.

### SAR — Arithmetic Shift (Signed)

```asm
sar rax, 4           ; rax >>= 4, sign-extended
```

`SAR` copies the **sign bit** into the vacated high bits instead of zero. This is what makes it correct for signed division by a power of two — `x >> 31` on a 32-bit signed value produces all-1s if `x` is negative and all-0s if not, which is exactly why you'll see:

```asm
mov  eax, [x]
cdq                  ; sign-extend eax into edx (edx = 0 or -1)
sar  eax, 2           ; can't just shift — rounds toward -infinity, not 0
sub  eax, edx
sar  eax, 0           ; (compilers emit an add+sar combination here, not a bare shift)
```

The takeaway: seeing `sar` instead of `shr` is itself a signal that the source used a *signed* type. A bare `sar reg, N` alone still doesn't match C's round-toward-zero division exactly — real compiler output adds a rounding fixup before the shift when the value can be negative, which is why signed division looks more elaborate than unsigned division in disassembly.

### ROL / ROR — Rotate

```asm
rol rax, 8           ; rotate left 8 bits — bits that fall off the top come back in at the bottom
ror rax, 8           ; rotate right 8 bits
```

Nothing is lost — a rotate is a shift where the bits that fall off one end wrap around to the other. Rotates barely ever appear in ordinary application logic; when you do see one, it's almost always **hashing or crypto** — mixing functions in MD5, SHA-1/2, and many block ciphers rotate intermediate state every round precisely because rotation is fast, reversible, and destroys no information. A tight loop full of `rol`/`ror` plus the magic constants from the [Common Patterns](/course/assembly/a5) lesson is a strong hash/cipher fingerprint.

### BT / BTS / BTR / BTC — Bit Test and Modify

```asm
bt   rax, 5          ; CF = bit 5 of rax  (test only, no write)
bts  rax, 5          ; CF = bit 5, then set bit 5 to 1
btr  rax, 5          ; CF = bit 5, then clear bit 5 to 0
btc  rax, 5          ; CF = bit 5, then flip bit 5
```

These read one bit into `CF` and optionally write it back changed. Compilers emit them for flag-style bitfields (`if (flags & (1 << 5))`) when the bit index isn't known until runtime — a fixed compile-time bit index usually just becomes a plain `test`/`and` instead, so seeing `bt` with a *register* index is a signal the index is a variable, not a constant.

### BSF / BSR — Bit Scan

```asm
bsf rdx, rax         ; rdx = index of the lowest set bit in rax (ZF=1 if rax==0)
bsr rdx, rax         ; rdx = index of the highest set bit in rax
```

"Find the first/last 1 bit" is a common building block — for a bitmask of free slots, `bsf` finds the first free one in one instruction instead of a 64-iteration loop. Watch for the `ZF` check right after: since the result is undefined when the input is zero, correct code always guards with a zero-test first.

### POPCNT / LZCNT / TZCNT — Counting

```asm
popcnt rsi, rbx      ; rsi = number of set bits in rbx
lzcnt  rsi, rbx       ; rsi = number of leading zero bits
tzcnt  rsi, rbx       ; rsi = number of trailing zero bits
```

`POPCNT` replaces what would otherwise be a shift-and-mask loop or lookup table for counting set bits — seeing it is a giveaway the source used `__builtin_popcount` or similar. `TZCNT` computes the same thing `BSF` does when the input is nonzero, but is defined (returns the operand width) when the input is zero, so newer compilers prefer it once the target CPU is known to support it.

### Compiler Patterns

| C code | Assembly |
|--------|----------|
| `x << 3` | `shl eax, 3` |
| `x >> 3` (unsigned) | `shr eax, 3` |
| `x >> 3` (signed) | `sar eax, 3` (plus a rounding fixup if `x` can be negative) |
| `x & (1 << n)` | `bt eax, n` (variable `n`) or `test eax, imm` (constant `n`) |
| `__builtin_popcount(x)` | `popcnt eax, eax` |
| `x = (x << 8) \| (x >> 24)` (32-bit rotate idiom) | `rol eax, 8` — compilers recognize this exact shift-or pattern and fold it into one instruction |

## Interactive: Shift & Rotate Playground

Step through a sequence mixing `SHL`, `SAR`, `ROL`, `BSF`, and `POPCNT`. Watch which ones touch `CF` and which don't, and compare the bit pattern before and after each rotate.

## Takeaway

> A shift moves bits and drops them. A rotate moves bits and keeps them. Learning to tell `SHR` from `SAR` at a glance tells you whether the source was signed.

Next: **SIMD & Floating-Point** — the register file and instructions compilers use once integers aren't enough either.
