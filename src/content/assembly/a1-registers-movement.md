---
id: a1
module: assembly
title: "Registers & Data Movement"
order: 1
objectives:
  - "Master MOV variants: MOV, MOVZX, MOVSX, MOVABS, LEA"
  - Understand zero/sign extension mechanics
  - Distinguish LEA (address computation) from memory access
  - Recognize common compiler patterns for variable assignment
interactive: "AssemblyVisualizer"
lab: ""
duration: 20
---

## Data Movement: The Foundation

`MOV` is the most frequent instruction. But its variants encode critical semantic information.

### MOV — Copy

```asm
mov rax, rbx        ; Register → Register
mov rax, 0x401000   ; Immediate → Register (64-bit imm = MOVABS)
mov [rbp-8], rax    ; Register → Memory
mov rax, [rbp-8]    ; Memory → Register
mov [rbp-8], 42     ; Immediate → Memory
```

**No memory-to-memory**. Always involves a register.

### MOVZX / MOVSX — Extend

| Instruction | Action | Use Case |
|-------------|--------|----------|
| `movzx eax, bl` | Zero-extend 8-bit → 32-bit (upper 32 zeroed) | Unsigned char → int |
| `movsx eax, bl` | Sign-extend 8-bit → 32-bit (upper 32 = sign bit) | Signed char → int |
| `movzx rax, bx` | Zero-extend 16-bit → 64-bit | Unsigned short → long |
| `movsx rax, bx` | Sign-extend 16-bit → 64-bit | Signed short → long |

**Critical**: In x86-64, writing a 32-bit register (`EAX`) **zero-extends** to 64-bit (`RAX`). Writing 8/16-bit does **not** affect upper bits.

```asm
mov eax, 0xFFFFFFFF  ; RAX = 0x00000000FFFFFFFF (zero-extended!)
mov al, 0xFF         ; RAX = 0x????????????00FF (upper 56 bits unchanged)
```

### LEA — Load Effective Address

```asm
lea rax, [rbx + rcx*4 + 0x10]  ; rax = rbx + rcx*4 + 0x10
```

**LEA does NOT access memory**. It computes the address the brackets *would* access.

**Compiler uses LEA for arithmetic**:
```c
int x = a + b * 4 + 16;
```
```asm
lea eax, [rdx + rcx*4 + 0x10]  ; Single instruction, no memory access
```

### XCHG — Atomic Swap

```asm
xchg rax, rbx        ; Swap (implicit LOCK on memory)
xchg [mem], rax      ; Atomic exchange with memory
```

## Register Conventions in Practice

### Win64 Calling Convention

```c
// Caller sets up:
RCX = arg1, RDX = arg2, R8 = arg3, R9 = arg4
// Stack: shadow space (32B) + args 5+
call func

// Callee prologue:
push rbp
mov rbp, rsp
sub rsp, locals + 32  ; Shadow space always reserved
```

### Register Preservation

| Category | Registers | Responsibility |
|----------|-----------|----------------|
| **Volatile** | RAX, RCX, RDX, R8-R11 | Caller saves if needed |
| **Non-volatile** | RBX, RBP, RDI, RSI, R12-R15 | Callee saves/restores |
| **Special** | RSP, RIP | Hardware-managed |

## Interactive: Data Movement Playground


**Sequence**:
1. `mov rax, 0x1122334455667788` — Full 64-bit immediate
2. `mov eax, 0xAABBCCDD` — Zero-extends to 64-bit
3. `mov al, 0xEF` — Only low 8 bits
4. `movzx rax, al` — Zero-extend 8→64
5. `movsx rax, al` — Sign-extend 8→64 (0xEF = -17 → 0xFFFFFFFFFFFFFFEF)
6. `lea rbx, [rax + 0x10]` — Address arithmetic

## Common Patterns

| C Code | Assembly Pattern |
|--------|------------------|
| `int x = 5;` | `mov dword ptr [rbp-4], 5` |
| `char c = 'A';` | `mov byte ptr [rbp-1], 41h` |
| `x = y;` | `mov eax, [rbp-8]` / `mov [rbp-4], eax` |
| `x = (int)c;` | `movsx eax, byte ptr [rbp-1]` |
| `x = (unsigned)c;` | `movzx eax, byte ptr [rbp-1]` |
| `p = &x;` | `lea rax, [rbp-4]` |
| `x = *p;` | `mov rax, [rbp-8]` / `mov eax, [rax]` |

## Takeaway

> `MOV` copies. `MOVZX/MOVSX` extend with semantics. `LEA` computes addresses without memory access. The suffix tells you the *type* of the operation.

Next: **Arithmetic & Logic** — ADD/SUB, flags, TEST/CMP, and how conditions are evaluated.