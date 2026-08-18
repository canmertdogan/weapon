---
id: sa5
module: static-analysis
title: "Decompilation"
order: 5
objectives:
  - "Read decompiler output as C-like pseudocode"
  - "Understand what decompilation can and cannot recover"
  - "Cross-check pseudocode against raw assembly"
  - "Recover control flow and data types from pseudocode"
interactive: "InstructionPlayground"
lab: "lab-07"
duration: 20
---

## Pseudocode Is a Lens, Not Truth

A decompiler (Ghidra, IDA Hex-Rays) reconstructs C-like pseudocode from assembly. It is the single biggest productivity boost in reverse engineering — but it can be wrong.

### Reading Decompiler Output

```c
undefined4 validate(int key) {
  int result;
  if (key * 4 + 3 == 0x1f) {
    result = 1;
  } else {
    result = 0;
  }
  return result;
}
```

From the assembly:

```asm
mov  eax, [rbp+8]     ; key
imul eax, eax, 4
add  eax, 3
cmp  eax, 0x1f
jne  fail
```

The decompiler recovered the arithmetic and the branch — correctly.

### What Decompilation Cannot Recover

- **Variable names** — everything becomes `var_1`, `iVar2`, `uVar3`.
- **Types** — `int` vs `unsigned` vs `char*` are guesses.
- **Original structure** — a `switch` may come back as a chain of `if`s.
- **Inlined functions** — boundaries disappear.
- **Optimized code** — may produce *worse* pseudocode than the assembly.

### The Golden Rule

**Never trust pseudocode alone.** When something looks wrong, go back to the disassembly. The decompiler is a hypothesis generator, not an oracle.

### Improving Pseudocode

- Rename variables (`key`, `result`) and the decompiler re-renders cleanly.
- Fix types (`int` → `DWORD`) and comparisons change meaning.
- Retype structs and member access becomes readable.

## Interactive: Assembly vs Pseudocode

The playground below runs the arithmetic from the example. Step it and confirm the decompiler's logic matches the machine's.

## Takeaway

> Decompile to get oriented, disassemble to get it right.

**Lab 7**: Decompiler Output → [Decompiler Output](/labs/lab-07)
