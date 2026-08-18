---
id: arm2
module: arm-mobile
title: "ARM64 Calling Convention & the Stack"
order: 2
objectives:
  - "Map AAPCS64: X0-X7 for arguments, X0 for the return value, X30 as the link register"
  - "Explain how BL/RET use the link register instead of a pushed return address like x86's CALL/RET"
  - "Trace a stack frame set up with STP/LDP (store/load pair)"
  - "Trace register state through a short ARM64 routine by hand"
interactive: ""
lab: "lab-21"
duration: 20
---

## The ABI Is the Contract Between Functions

Reading disassembled ARM64 without knowing the calling convention is like reading a conversation with one side redacted — you can see values move but not what they mean. **AAPCS64** (the ARM 64-bit Procedure Call Standard) defines exactly which registers carry arguments, results, and saved state, so every function call follows the same shape.

### Argument and Return Registers

```
X0-X7    up to 8 integer/pointer arguments, in order
X0       return value (X1 too, for wider results)
X8       indirect result register (hidden pointer for large struct returns)
```

Compare with x86-64 System V, where the first six integer arguments go in `RDI, RSI, RDX, RCX, R8, R9`. Same idea — a fixed register order avoids stack traffic for typical calls — but AAPCS64 gives you two more argument slots before it has to spill to the stack, and the return value convention (`X0`) plays the same role as `RAX`.

### The Link Register: No Pushed Return Address

This is the other big structural difference from x86. A `call` on x86 pushes the return address onto the stack, and `ret` pops it back off — every call touches memory. ARM64's `bl` (branch with link) instead writes the return address directly into `X30`, the **link register**, and `ret` just jumps to whatever `X30` holds. No stack write, no stack read, for the call/return itself.

The consequence matters for both performance and security analysis: a **leaf function** — one that doesn't call anything else — never needs to touch the stack at all. It can do all its work in registers and `ret` straight from `X30`. That also narrows what a stack-based buffer overflow can even reach: if the return address never lived on the stack in the first place, corrupting a local buffer in a leaf function can't hijack control flow the way it classically does on x86. The danger shifts to non-leaf functions, which — as below — have to explicitly save `X30` to the stack before calling anything else, and that saved copy becomes the target.

### STP/LDP: Building a Stack Frame

Because a non-leaf function's own `X30` will be overwritten by the next `bl` it executes, it must save its own return address (and often the frame pointer `X29`) before making any calls. ARM64 does this efficiently with **STP**/**LDP** — store-pair and load-pair — which move two registers to or from memory in a single instruction:

```
stp x29, x30, [sp, #-16]!   ; push frame pointer + link register, pre-decrement SP
mov x29, sp                  ; establish new frame pointer
...                           ; function body, free to call other functions
ldp x29, x30, [sp], #16      ; pop them back, post-increment SP
ret                           ; return via X30
```

The `!` and post-index `[sp], #16` forms are ARM's addressing modes for adjusting `SP` as part of the same instruction — no separate `sub sp, sp, #16` needed. Seeing `stp`/`ldp` bracketing a function body is the ARM64 equivalent of spotting `push rbp` / `pop rbp` prologue-epilogue pairs on x86.

### Tracing a Routine by Hand

Lab 21 has you trace this exact sequence — walk it here first:

```
mov x0, #10
mov x1, #3
loop:
add x0, x0, x1
sub x1, x1, #1
cmp x1, #0
bne loop
mov x2, x0
ret
```

`mov` loads immediates into `X0` and `X1`. Each loop iteration adds `X1` into `X0`, decrements `X1`, and `cmp x1, #0` sets condition flags (internally, `cmp` is `subs xzr, x1, #0` — a subtraction that discards the result but keeps the flags, the same zero-register trick from `arm1`). `bne loop` branches back while the zero flag is clear. When `X1` hits 0, the loop falls through, the final total is copied into `X2`, and `ret` returns via `X30` — this is a leaf-shaped tail with no `stp`/`ldp` needed since it never calls out.

## Takeaway

> AAPCS64 puts the return address in a register, not on the stack — non-leaf functions have to spill X30 explicitly with STP, and that spill is where a stack overflow's real target lives.

**Lab 21**: ARM64 Register Trace → [ARM64 Register Trace](/labs/lab-21)
