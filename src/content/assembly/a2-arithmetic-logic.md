---
id: a2
module: assembly
title: "Arithmetic & Logic"
order: 2
objectives:
  - Execute ADD/SUB/IMUL/IDIV and predict flag results
  - Use INC/DEC/NEG and understand their flag behavior
  - Apply AND/OR/XOR/NOT for bit manipulation
  - Master TEST/CMP for conditional logic without destination modification
  - Recognize common compiler patterns for arithmetic/logic
  - Calculate flag states for given inputs
interactive: "InstructionPlayground"
lab: "lab-03"
duration: 25
---

## Arithmetic Instructions

### ADD / SUB — Basic Math

```asm
add rax, rbx        ; rax += rbx, sets flags
sub rax, rbx        ; rax -= rbx, sets flags
add [rbp-8], 5      ; Memory += immediate
```

**Flags affected**: OF, SF, ZF, AF, PF, CF
- **CF** = Unsigned carry/borrow (carry out of MSB)
- **OF** = Signed overflow (carry into MSB ≠ carry out of MSB)
- **ZF** = Result == 0
- **SF** = Result sign (MSB = 1 for negative)
- **AF** = Auxiliary carry (bit 3 → bit 4) — BCD arithmetic
- **PF** = Parity of low 8 bits (even parity = 1)

#### Flag Calculation Examples

| Operation | Result (hex) | CF | OF | ZF | SF | PF |
|-----------|--------------|----|----|----|----|----|
| `add al, 0x80` + `0x80` | 0x00 | 1 | 1 | 1 | 0 | 1 |
| `add rax, 0x7FFFFFFFFFFFFFFF` + 1 | 0x8000000000000000 | 0 | 1 | 0 | 1 | 1 |
| `sub rax, 5` - 10 | 0xFFFFFFFFFFFFFFFB | 1 | 0 | 0 | 1 | 0 |

---

### INC / DEC — Increment/Decrement

```asm
inc rax             ; rax += 1, sets OF,SF,ZF,AF,PF — **NOT CF**
dec rax             ; rax -= 1, sets OF,SF,ZF,AF,PF — **NOT CF**
```

**Why no CF?** Loop counters shouldn't affect carry for multi-precision math. This allows `inc`/`dec` in loops without corrupting `adc`/`sbb` chains.

**Optimization**: `inc`/`dec` are shorter (1-2 bytes) than `add`/`sub` with immediate 1.

---

### IMUL / IDIV — Signed Multiply/Divide

```asm
imul rax, rbx       ; rax = rax * rbx (signed, 64×64→64, truncates)
imul rax, rbx, 5    ; rax = rbx * 5 (3-operand form, common!)
imul rax, 5         ; rax = rax * 5

; IDIV — Divides RDX:RAX by operand
;   RAX = Quotient, RDX = Remainder
cqo                 ; Sign-extend RAX → RDX:RAX (critical before IDIV)
idiv rbx            ; Signed divide
```

**MUL/DIV** = Unsigned variants. `MUL` uses `RAX`, `DIV` uses `RDX:RAX`.

#### IMUL Forms

| Form | Encoding | Operation | Use Case |
|------|----------|-----------|----------|
| One-operand | `F6/5` / `F7/5` | `AX*r/m8`→`DX:AX`, `EAX*r/m32`→`EDX:EAX`, `RAX*r/m64`→`RDX:RAX` | Full 128-bit result |
| Two-operand | `0F AF /r` | `reg *= r/m` | Truncated 64×64→64 |
| **Three-operand** | **`6B/69 /r ib/iw/id`** | **`reg = r/m * imm`** | **Constants (most common in compiler output)** |

#### IDIV Details

```asm
; Signed 64-bit division: RDX:RAX / rbx
; RAX = quotient, RDX = remainder
cqo                 ; RAX → RDX:RAX (sign-extend)
idiv rbx            ; Divide

; Unsigned: DIV uses RDX:RAX directly (zero RDX first)
xor rdx, rdx        ; Clear RDX for unsigned
div rbx             ; Unsigned divide
```

**Exceptions**: Division by zero → `#DE` (Exception 0). Overflow (quotient too large) → `#DE`.

---

### NEG — Two's Complement Negation

```asm
neg rax             ; rax = -rax (0 - rax), sets flags
```

**Flags**: CF = 1 unless rax was 0. OF = 1 if rax = 0x8000... (INT64_MIN).

`NEG` is equivalent to `NOT` + `INC` but atomic and sets flags differently.

---

## Logic Instructions

### AND / OR / XOR — Bitwise

```asm
and rax, rbx        ; rax &= rbx
or  rax, rbx        ; rax |= rbx
xor rax, rbx        ; rax ^= rbx
```

**XOR tricks**:
- `xor eax, eax` → Zero register (2 bytes: `31 C0`, zero-extends to fill RAX — preferred over `mov rax, 0` = 7 bytes)
- `xor rax, -1` → Bitwise NOT (but see NOT below)
- `xor rax, rbx` / `xor rbx, rax` / `xor rax, rbx` → Swap without temp

---

### NOT — Bitwise NOT

```asm
not rax             ; rax = ~rax, **no flags affected**
```

---

### TEST / CMP — Compare Without Store

| Instruction | Operation | Flags | Use Case |
|-------------|-----------|-------|----------|
| `test rax, rbx` | `rax & rbx` | SF,ZF,PF (OF=CF=0) | Check bits, zero-test |
| `cmp rax, rbx` | `rax - rbx` | All flags | Compare for branches |

**TEST** is `AND` without destination write.
**CMP** is `SUB` without destination write.

---

## Flag Logic for Conditions

| Condition | Unsigned | Signed | Flags Checked |
|-----------|----------|--------|---------------|
| Equal | `JE` / `JZ` | `JE` / `JZ` | ZF = 1 |
| Not Equal | `JNE` / `JNZ` | `JNE` / `JNZ` | ZF = 0 |
| Above | `JA` / `JNBE` | — | CF = 0, ZF = 0 |
| Below | `JB` / `JNAE` | — | CF = 1 |
| Above/Equal | `JAE` / `JNB` | — | CF = 0 |
| Below/Equal | `JBE` / `JNA` | — | CF = 1 or ZF = 1 |
| Greater | — | `JG` / `JNLE` | ZF = 0, SF = OF |
| Less | — | `JL` / `JNGE` | SF ≠ OF |
| Greater/Equal | — | `JGE` / `JNL` | SF = OF |
| Less/Equal | — | `JLE` / `JNG` | ZF = 1 or SF ≠ OF |

### Signed vs Unsigned: The Key Insight

- **Unsigned** comparisons use **CF** (carry flag)
- **Signed** comparisons use **SF ≠ OF** (sign vs overflow)
- **Equal/Not Equal** use **ZF** (same for both)

**Why SF ≠ OF for signed?**
- If no overflow (OF=0): SF reflects true sign → SF=1 means negative (less)
- If overflow (OF=1): Sign flipped → SF=1 actually means positive (greater)
- XOR captures this: SF ⊕ OF = true sign

---

## Interactive: Flag Explorer


**Try these sequences**:
1. `mov rax, 5` / `add rax, 3` / `sub rax, 1` — Watch ZF, SF, OF, CF
2. `mov rax, 0x7FFFFFFFFFFFFFFF` / `add rax, 1` — Signed overflow (OF=1)
3. `mov rax, 0xFFFFFFFFFFFFFFFF` / `add rax, 1` — Unsigned carry (CF=1)
4. `mov rax, 10` / `cmp rax, 5` / `test rax, rax` — Compare vs test

---

## Common Compiler Patterns

| C Code | Assembly | Notes |
|--------|----------|-------|
| `x = a + b;` | `mov eax, [a]` / `add eax, [b]` | |
| `x = a - b;` | `mov eax, [a]` / `sub eax, [b]` | |
| `x = a * 5;` | `imul eax, [a], 5` | 3-operand IMUL |
| `x = a / 2;` | `mov eax, [a]` / `cdq` / `mov ecx, 2` / `idiv ecx` | Signed: CDQ sign-extends; IDIV has no immediate form |
| `x = a / 2;` | `mov eax, [a]` / `shr eax, 1` | Unsigned: shift (faster) |
| `x = a % 2;` | `mov eax, [a]` / `and eax, 1` | Power of 2: bitmask |
| `if (x == 0)` | `test eax, eax` / `je` | TEST preferred over CMP |
| `if (x & 4)` | `test eax, 4` / `jne` | Bit test |
| `x = ~x;` | `not eax` | |
| `x = -x;` | `neg eax` | |
| `x *= 9;` | `lea eax, [rax + rax*8]` | LEA for multiply by constant |
| `x = a * 13;` | `imul eax, [a], 13` | Or `lea` + `add` sequence |

### LEA Arithmetic

`LEA` (Load Effective Address) computes addresses but **does not access memory** — often abused for arithmetic:

```asm
lea rax, [rbx + rcx*4]    ; rax = rbx + rcx*4 (no memory access)
lea rax, [rax + rax*2]    ; rax *= 3
lea rax, [rax + rax*4]    ; rax *= 5
lea rax, [rax + rax*8]    ; rax *= 9
```

---

## Flag Mechanics Deep Dive

### Carry Flag (CF) — Unsigned Overflow

```
   1 1 1 1  (carry in)
  1 1 1 1  1111 = 0xF
+ 0 0 0 1  0001 = 0x1
-----------
 0 0 0 0  0000 = 0x0  CF=1 (carry out)
```

### Overflow Flag (OF) — Signed Overflow

```
  0 1 1 1  0111 = +7
+ 0 0 0 1  0001 = +1
-----------
  1 0 0 0  1000 = -8  OF=1 (sign changed incorrectly)
```

**OF Formula**: `OF = (carry into MSB) XOR (carry out of MSB)`

### Parity Flag (PF) — Even Parity of Low Byte

```
Result low byte: 0x55 (01010101) → 4 bits set → Even → PF=1
Result low byte: 0x54 (01010100) → 3 bits set → Odd  → PF=0
```

---

## Takeaway

> Arithmetic sets flags. Logic manipulates bits. TEST/CMP are **flag-setters without side effects**. The conditional jump *consumes* the flags.

**Lab 3**: Trace flag changes → [Control Flow Tracing](/labs/lab-03)

Next: **Stack & Functions** — Calling conventions, prologue/epilogue, and stack frame forensics.

---

## Practice Exercises

1. **Flag Prediction**: Given `mov al, 0x7F` / `add al, 1` — what are CF, OF, ZF, SF, PF?
2. **Signed vs Unsigned**: `mov eax, 0xFFFFFFFE` (-2 signed, 4294967294 unsigned) / `cmp eax, 1` — which jumps are taken: `JA`, `JG`, `JB`, `JL`?
3. **Optimization**: Rewrite `x = x * 7` using only `LEA` and `ADD`/`SUB`.
4. **Division**: What does `cqo` / `idiv rbx` compute if `RAX=0xFFFFFFFFFFFFFFFF` (-1) and `RBX=2`?
5. **Bit Tricks**: What does `x & (x-1)` do? (Hint: clears lowest set bit). What about `x & -x`?
6. **Compiler Recognition**: Identify the pattern: `mov eax, [rbp-4]` / `and eax, 0xF` / `shl eax, 2` / `mov rax, [rdx+rax*8]`.