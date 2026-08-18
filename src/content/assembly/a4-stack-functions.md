---
id: a4
module: assembly
title: "Stack & Functions"
order: 4
objectives:
  - "Trace CALL and RET mechanics through the stack"
  - "Explain Win64 and SysV calling conventions"
  - "Reconstruct stack frames from prologue and epilogue"
  - "Understand shadow space and stack alignment"
interactive: "StackVisualizer"
lab: "lab-18"
duration: 25
---

## Functions Are Stack Discipline

A function is a contract between caller and callee, expressed in stack layout and register usage. The `CALL`/`RET` pair implements this contract.

### CALL / RET

```asm
call 0x401000    ; push return address (RIP), then RIP = 0x401000
; ... callee runs ...
ret              ; pop return address into RIP
```

`CALL` pushes the address of the *next* instruction. `RET` pops it back. Everything else — arguments, locals, saved registers — is convention.

## The Standard Prologue / Epilogue

```asm
; PROLOGUE
push rbp          ; save caller's frame pointer
mov  rbp, rsp     ; establish our frame
sub  rsp, 0x40    ; reserve locals + alignment + shadow space

; BODY
;   [rbp-0x8]  = local
;   [rbp+0x30] = 5th argument

; EPILOGUE
mov  rsp, rbp     ; (if RBP was used) deallocate
pop  rbp          ; restore caller's RBP
ret
```

**Optimized builds** often omit the frame pointer (`/O2`): locals are addressed as `[rsp+offset]` and there is no `push rbp`. Harder to read, but faster.

## Calling Conventions

| Convention | 1st | 2nd | 3rd | 4th | Extra | Return | Shadow space |
|---|---|---|---|---|---|---|---|
| **Win64** | RCX | RDX | R8 | R9 | on stack (right-to-left) | RAX | 32 bytes reserved |
| **SysV AMD64** | RDI | RSI | RDX | RCX | on stack | RAX | none |

### Shadow Space (Win64)

The caller reserves **32 bytes** above the return address so the callee can spill its four register arguments. It exists even if the callee doesn't use it.

```asm
; call foo(1, 2, 3, 4, 5)
mov  rcx, 1        ; arg1
mov  rdx, 2        ; arg2
mov  r8,  3        ; arg3
mov  r9,  4        ; arg4
sub  rsp, 0x28     ; shadow space (0x20) + 5th arg (0x8)
mov  [rsp+0x20], 5 ; 5th arg on stack
call foo
```

### Stack Alignment

Before a `CALL`, `RSP` must be 16-byte aligned (SysV: `RSP % 16 == 0` at the `CALL`; Win64 similar). The prologue's `sub rsp, N` keeps it aligned.

## Reading a Function Frame

Given `[rbp + 0x8]` and `[rbp - 0x4]`:

```
HIGH  ┌──────────────────┐
      │ arg 5 (if any)   │  [rbp + 0x30]
      │ ...              │
      │ return address   │  [rbp + 0x8]
      │ saved RBP        │  [rbp + 0x0]  ← RBP
      │ local 1          │  [rbp - 0x4]
      │ local 2          │  [rbp - 0x8]
LOW   └──────────────────┘  ← RSP
```

Positive offsets = arguments + saved registers. Negative offsets = locals.

## Interactive: Function Frame Explorer

Step through a function's prologue and epilogue to watch the frame build and tear down.

## Takeaway

> A function is a stack convention. Read the prologue to find locals, the call site to find arguments, and the epilogue to confirm the frame.

**Lab 18**: Reconstruct a call stack from a trace → [Call Stack Reconstruction](/labs/lab-18)
