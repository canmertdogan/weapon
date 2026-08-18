---
id: a5
module: assembly
title: "Common Patterns"
order: 5
objectives:
  - "Recognize switch tables and jump tables"
  - "Identify vtables and virtual dispatch"
  - "Spot string operations and crypto constants"
  - "Understand why compilers emit the idioms they do"
interactive: "ControlFlowVisualizer"
lab: ""
duration: 20
---

## Compilers Are Predictable

Compilers generate recognizable idioms. Once you learn them, you stop reading instruction-by-instruction and start reading *patterns*.

### Switch Statements

A dense `switch` becomes a **jump table**: an array of target addresses indexed by the case value.

```asm
mov  eax, [rbp-4]      ; switch value
cmp  eax, 2            ; bounds check
ja   default           ; out of range → default
lea  rdx, [jump_table]
jmp  [rdx + rax*8]     ; indirect jump into table
```

- **Dense cases** → jump table (`jmp [rax*8 + table]`)
- **Sparse cases** → binary search of comparisons

### Virtual Dispatch (C++)

A virtual method call goes through the **vtable** — a table of function pointers stored in the object.

```asm
mov  rax, [rcx]        ; load vtable pointer (rcx = this)
call [rax + 0x18]      ; call the 4th virtual method
```

Seeing `call [rax + imm]` is a strong signal of C++ virtual dispatch.

### String Operations

```asm
lea  rdi, [dst]
lea  rsi, [src]
mov  ecx, 0x10         ; length
rep movsb              ; memcpy
```

`rep movsb`/`rep stosb` with a `mov ecx, N` before it = `memcpy`/`memset`. Recognizable at a glance.

### XOR Zeroing

```asm
xor eax, eax           ; eax = 0  (2 bytes, no flags issues)
```

Compilers prefer `xor eax, eax` over `mov eax, 0` because it's shorter and breaks dependency chains. Frequent occurrences of `xor reg, reg` are normal, not suspicious.

### Crypto Constants

Magic numbers reveal algorithms:

| Constant | Algorithm |
|----------|-----------|
| `0x67452301` | MD5 |
| `0x6A09E667` | SHA-256 |
| `0x243F6A88` | Blowfish |
| `0x9E3779B9` | TEA / XTEA |
| `0x811C9DC5` | FNV-1a hash |

Finding these in `.rdata` or as immediates pinpoints a crypto primitive instantly. (AES doesn't ship a single magic constant — its S-box is a full 256-byte table built from GF(2⁸) multiplicative inverses plus an affine transform. You recognize AES in disassembly by the S-box/Rcon table contents and the `aesenc`/`aesenclast` instructions, not by one number.)

### Stack Canaries

```asm
mov  rax, [rbp-8]      ; load canary
xor  rax, fs:[0x28]    ; compare to expected
jne  __stack_chk_fail  ; mismatch → fail
```

The `/GS` cookie check before `ret` marks a stack-protected function.

## Interactive: Switch / Jump Table

The graph below shows a dense switch compiled to a jump table. Click each node.

## Takeaway

> Learn the idioms, and a function that took 50 instructions to read becomes a single line of C.

Next: **Shifts, Rotates & Bit Tricks** — the bitwise instructions compilers reach for once addition and subtraction aren't enough.
