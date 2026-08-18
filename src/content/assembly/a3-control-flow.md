---
id: a3
module: assembly
title: "Control Flow"
order: 3
objectives:
  - "Understand how JMP and Jcc instructions redirect execution"
  - "Read and reconstruct control-flow graphs from disassembly"
  - "Recognize the compiler patterns behind if/else and loops"
  - "Trace a branch by evaluating flags, not by guessing"
  - "Identify switch statements (jump tables) and their patterns"
  - "Analyze indirect jumps and virtual calls"
interactive: "ControlFlowVisualizer"
lab: ""
duration: 20
---

## Branching: The Heart of Logic

Every interesting behavior — validation, loops, switches — is a decision. In assembly, decisions are encoded with conditional jumps.

### JMP — Unconditional

```asm
jmp 0x401000        ; RIP = 0x401000, no questions asked
jmp rax             ; Indirect jump: RIP = RAX
jmp [rip+0x1234]    ; RIP = qword at [RIP+0x1234] (PIC/relocated)
```

**Short vs Near**: `EB cb` (short, 2 bytes, ±128) vs `E9 cd` (near, 5 bytes, ±2GB).

---

### Jcc — Conditional

```asm
cmp eax, 1
je  0x401050        ; jump IF ZF = 1 (eax == 1)
```

The conditional jump **reads the flags** set by the previous arithmetic/logic instruction. It doesn't compute anything itself.

---

## Complete Conditional Jump Reference

| Mnemonic | Condition | Flags Tested | Signed/Unsigned | Opposite |
|----------|-----------|--------------|-----------------|----------|
| `JO` / `JNO` | Overflow | OF=1 / OF=0 | — | — |
| `JS` / `JNS` | Sign | SF=1 / SF=0 | — | — |
| `JE` / `JZ` | Equal / Zero | ZF=1 | Both | `JNE` / `JNZ` |
| `JNE` / `JNZ` | Not Equal / Not Zero | ZF=0 | Both | `JE` / `JZ` |
| `JB` / `JNAE` / `JC` | Below / Not Above or Equal / Carry | CF=1 | Unsigned | `JNB` / `JAE` / `JNC` |
| `JNB` / `JAE` / `JNC` | Not Below / Above or Equal / Not Carry | CF=0 | Unsigned | `JB` / `JNAE` / `JC` |
| `JBE` / `JNA` | Below or Equal / Not Above | CF=1 or ZF=1 | Unsigned | `JA` / `JNBE` |
| `JA` / `JNBE` | Above / Not Below or Equal | CF=0 and ZF=0 | Unsigned | `JBE` / `JNA` |
| `JL` / `JNGE` | Less / Not Greater or Equal | SF≠OF | Signed | `JGE` / `JNL` |
| `JGE` / `JNL` | Greater or Equal / Not Less | SF=OF | Signed | `JL` / `JNGE` |
| `JLE` / `JNG` | Less or Equal / Not Greater | ZF=1 or SF≠OF | Signed | `JG` / `JNLE` |
| `JG` / `JNLE` | Greater / Not Less or Equal | ZF=0 and SF=OF | Signed | `JLE` / `JNG` |
| `JP` / `JPE` | Parity / Parity Even | PF=1 | — | `JNP` / `JPO` |
| `JNP` / `JPO` | Not Parity / Parity Odd | PF=0 | — | `JP` / `JPE` |
| `JCXZ` / `JECXZ` | CX/ECX/RCX = 0 | (RCX==0) | Loop | — |

**Note**: `JC`/`JNC` = `JB`/`JNB` (synonyms). `JZ`/`JNZ` = `JE`/`JNE` (synonyms).

---

## From Assembly to a Control-Flow Graph

A disassembler shows a flat list. A reverse engineer sees a graph:

```
        ┌─────────┐
        │ START   │
        └────┬────┘
             │
           cmp eax, 1
           ┌────┴────┐
         ==1│         │!=1
         ┌───┴───┐ ┌───┴───┐
         │FUNC A │ │FUNC B │
         └───┬───┘ └───┬───┘
             └────┬────┘
               ┌──┴──┐
               │ RET │
               └─────┘
```

**Basic blocks** are straight-line instruction sequences with no branches in or out (except entry/exit). Nodes are blocks; edges are jumps.

### Dominators & Loops

- **Dominator**: Node D dominates N if all paths to N go through D.
- **Loop Header**: Dominates all nodes in the loop, has a back-edge.
- **Natural Loop**: Header + all nodes that can reach header without going through header.

---

## Tracing Branches — A Discipline

When you hit a conditional jump:

1. **Identify the flag source** — What set the flags? (CMP, TEST, SUB, ADD...)
2. **Compute the flag values** — Which flags are 1, which are 0?
3. **Read the condition** — `je` = ZF, `jg` = ZF=0 & SF=OF, etc.
4. **Take or fall through** — One branch continues, the other is skipped.

**Never guess the branch.** Compute it.

### Example Trace

```asm
mov eax, [rbp-4]      ; Load local variable
cmp eax, 10
jg  greater_than_10   ; SF=OF, ZF=0
; fall through: less or equal
```

**Trace**:
- Suppose `[rbp-4] = 15`
- `cmp eax, 10` → `15 - 10 = 5` (positive, no overflow)
- SF=0, OF=0 → SF=OF → `JG` taken

---

## Recognizing Compiler Patterns

| C Code | Assembly Pattern |
|--------|------------------|
| `if (x == 0) {...}` | `test eax, eax` / `jne skip` |
| `if (a > b) {...}` | `cmp eax, ebx` / `jle skip` (signed) |
| `if (a > b) {...}` | `cmp eax, ebx` / `jbe skip` (unsigned) |
| `while (x < 10) {...}` | `loop: cmp eax, 10` / `jge exit` / `... / jmp loop` |
| `do {...} while (x);` | `loop: ... / test eax, eax` / `jne loop` |
| `for (i=0; i<n; i++)` | `xor eax, eax` / `loop: cmp eax, ecx` / `jge exit` / `... / inc eax / jmp loop` |
| `switch (x)` (dense) | Jump table via `jmp [rax*8 + table]` |

---

## Switch Statements: Jump Tables

### Dense Switch (Jump Table)

```c
switch (x) {
  case 0: a(); break;
  case 1: b(); break;
  case 2: c(); break;
  case 3: d(); break;
}
```

```asm
; eax = x
cmp eax, 3
ja  default          ; unsigned above = out of range
jmp [rax*8 + table]  ; RIP = table[rax]

table:
  dq case_0
  dq case_1
  dq case_2
  dq case_3
```

**Key indicators**:
- Bounds check (unsigned `ja` / `jbe`)
- Indirect jump through table: `jmp [base + index*8]`
- Table in `.rdata` (read-only)

### Sparse Switch (Binary Search / Decision Tree)

```c
switch (x) {
  case 100: a(); break;
  case 200: b(); break;
  case 300: c(); break;
}
```

```asm
cmp eax, 200
jl  check_100
je  case_200
jg  check_300
```

Ghidra/IDA often recover these as "switch" with "case" labels.

---

## Loops: Canonical Forms

### While Loop (Pre-test)

```c
while (cond) { body }
```

```asm
jmp test
loop:
  ; body
test:
  cmp ..., ...
  jcc loop
```

### Do-While Loop (Post-test)

```c
do { body } while (cond);
```

```asm
loop:
  ; body
  cmp ..., ...
  jcc loop
```

### For Loop

```c
for (init; cond; inc) { body }
```

```asm
  init
  jmp test
loop:
  ; body
  inc
test:
  cmp ..., ...
  jcc loop
```

### Loop with `LOOP` Instruction (Rare in x64)

```asm
mov rcx, 10
loop_start:
  ; body
  loop loop_start    ; RCX--, JNZ if RCX≠0
```

**Note**: `LOOP` is slow on modern CPUs — compilers avoid it. Uses `RCX` (not `ECX`/`CX` in 64-bit).

---

## Indirect Jumps & Calls

### Virtual Calls (C++ vtable)

```asm
mov rax, [rcx]       ; rax = vtable pointer (first member of object)
mov rax, [rax + 8]   ; rax = function pointer (offset 8 = 2nd virtual)
call rax
```

### Function Pointers

```asm
call [rip+func_ptr]  ; Direct call through pointer
call rax             ; Register-indirect
```

### Switch via Jump Table (Already Covered)

---

## Control Flow Obfuscation (Preview)

| Technique | Description | Detection |
|-----------|-------------|-----------|
| **Opaque Predicates** | `cmp eax, eax` / `jne never_taken` | Always same result, static analysis sees both paths |
| **Control Flow Flattening** | Dispatcher loop + state variable | CFG has single entry, many edges to dispatcher |
| **Fake Conditional Jumps** | `jz label` where ZF always 0/1 | Trace flags symbolically |
| **Overlapping Instructions** | Jump into middle of instruction | Disassembler confusion, multiple entry points |

---

## Interactive: Control-Flow Explorer


Click each node in the graph below to inspect its instructions and follow the branches.

---

## Takeaway

> A binary is not a linear list of instructions. It is a graph of decisions. Learn to read the graph.

Next: **Static Analysis** — strings, imports, and cross references.

---

## Practice Exercises

1. **CFG Reconstruction**: Given this snippet, draw the CFG:
   ```asm
   test eax, eax
   jz  zero
   cmp eax, 5
   jg  greater
   ; less_or_equal
   jmp end
   greater:
   zero:
   end:
   ```

2. **Loop Identification**: Which form is this?
   ```asm
   xor ecx, ecx
   loop_start:
     cmp ecx, eax
     jge exit
     ; body
     inc ecx
     jmp loop_start
   exit:
   ```

3. **Switch Recovery**: You see: `cmp eax, 9` / `ja default` / `jmp [rax*8 + 0x402000]`. How many cases? What's the range?

4. **Flag Trace**: `mov eax, -5` / `cmp eax, 0` / `jl negative`. Is the jump taken? Why? (SF=1, OF=0 → SF≠OF → taken)

5. **Opaque Predicate**: `xor eax, eax` / `inc eax` / `test eax, eax` / `jz never`. Why is this opaque?