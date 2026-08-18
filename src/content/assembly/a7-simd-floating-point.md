---
id: a7
module: assembly
title: "SIMD & Floating-Point"
order: 7
objectives:
  - "Explain why floating-point and vector math use a separate XMM/YMM register file instead of the GPRs"
  - "Read scalar SSE moves (MOVSS/MOVSD) and tell float from double operations at a glance"
  - "Read packed SSE arithmetic (ADDPS/MULPS) as one instruction doing several additions or multiplications at once"
  - "Recognize CVT* conversions between integer and floating-point representations"
duration: 25
---

## A Second Set of Registers for a Different Kind of Number

Every register touched so far — `RAX`, `RBX`, the rest of the general-purpose file — holds integers or raw bit patterns. None of them can natively hold an IEEE 754 floating-point value the way the ALU expects to operate on one. That's why x86-64 ships a completely separate register file, **XMM0–XMM15** (128 bits each, extended to **YMM0–YMM15** at 256 bits under AVX), with its own dedicated instruction set: **SSE** (and its successor **AVX**).

The moment you see an `xmm` register in disassembly, you're looking at floating-point or vectorized code — nothing else uses that register file.

### Scalar Moves: One Value at a Time

```asm
movss xmm0, [rdi]      ; load one 32-bit float
movsd xmm0, [rdi]      ; load one 64-bit double
movss [rsi], xmm0      ; store one float back out
```

The suffix tells you everything: **SS** = Scalar Single-precision (one `float`), **SD** = Scalar Double-precision (one `double`). `MOVAPS`/`MOVAPD` (Aligned Packed Single/Double) are the same idea but require 16-byte-aligned memory and are used when the compiler is moving a whole vector, not extracting one scalar value.

### Scalar Arithmetic

```asm
addss xmm0, xmm1       ; xmm0 = xmm0 + xmm1  (float)
mulsd xmm0, xmm1       ; xmm0 = xmm0 * xmm1  (double)
subss xmm0, xmm1
divsd xmm0, xmm1
```

Same naming scheme as the moves. `ADDSS`/`SUBSS`/`MULSS`/`DIVSS` are the float versions; swap the trailing `S` for `D` and you get double-precision. Note there's no `CMP` on `XMM` registers the way there is on GPRs — floating-point comparison uses `UCOMISS`/`COMISD`, which set the regular integer flags (`ZF`/`PF`/`CF`) so the following `Jcc` works exactly like it does after an integer `CMP`.

### Packed Arithmetic: Several Values at Once

```asm
addps xmm0, xmm1       ; four 32-bit floats added in parallel
mulpd xmm0, xmm1       ; two 64-bit doubles multiplied in parallel
```

Swap the scalar `S`/`D` suffix for **PS** (Packed Single — four floats side by side in one 128-bit register) or **PD** (Packed Double — two doubles). `ADDPS xmm0, xmm1` isn't "add one float" — it's four independent additions happening in the same instruction, one per 32-bit lane. This is what **auto-vectorization** looks like: a compiler notices a loop doing the same scalar float operation on consecutive array elements and rewrites it to process four (or eight, under AVX's `YMM`) at a time. A loop in the source that looks entirely scalar can legitimately compile down to `PS`/`PD` instructions — don't assume packed instructions mean the source used explicit vector types.

### Calling Convention: XMM0 Is the New RAX

Floating-point return values and the first several floating-point arguments travel in `XMM0`–`XMM7` (System V) or `XMM0`–`XMM3` (Win64), completely separate from the integer argument registers covered in [Stack & Functions](/course/assembly/a4). A function can take both integer and float arguments simultaneously, each consuming a slot from its *own* register sequence — `f(int a, double b, int c)` puts `a` in `RDI`, `b` in `XMM0`, and `c` in `RSI`, not `RDX`. Seeing `movsd xmm0, ...` right before a `ret` is the float/double equivalent of `mov rax, ...` before a `ret`.

### Conversions: Crossing the Integer/Float Boundary

```asm
cvtsi2sd xmm0, eax     ; int → double
cvttsd2si eax, xmm0    ; double → int, truncating toward zero
cvtsd2ss xmm1, xmm0    ; double → float (narrowing)
cvtss2sd xmm1, xmm0    ; float → double (widening)
```

Read the name left to right: `CVT` + source type + `2` + destination type, with an optional extra `T` meaning **truncate** rather than round. `(int)someDouble` in C always compiles to a `T`-variant (`CVTTSD2SI`) because C truncation semantics demand it; a bare `CVTSD2SI` (no `T`) rounds to the nearest integer instead and shows up far less often in ordinary code, mostly from explicit rounding calls.

### Reading the Pattern, Not Just the Instruction

| C code | Assembly shape |
|--------|-----------------|
| `float x = a + b;` | `movss xmm0, [a]` / `addss xmm0, [b]` |
| `double x = (double)i;` | `cvtsi2sd xmm0, [i]` |
| `int i = (int)x;` | `cvttsd2si eax, xmm0` |
| `for (i=0;i<n;i++) c[i]=a[i]+b[i];` (vectorized) | `movups`/`addps` on 4 elements per iteration, plus a scalar cleanup loop for the remainder |

That last row is worth internalizing: a vectorized loop in disassembly usually has a fast packed-`SIMD` main loop *and* a short scalar tail handling whatever doesn't divide evenly by 4 (or 8) — seeing both together is confirmation the compiler auto-vectorized, not evidence of two different features.

## Takeaway

> The moment `xmm` shows up, you're reading a different instruction set with its own register file — and the S/D and scalar/packed suffixes tell you exactly what kind of number, and how many at once, before you've parsed anything else.

Next: **Instruction Encoding** — what MOV, SHL, and ADDPS actually look like once they're compiled down to bytes.
