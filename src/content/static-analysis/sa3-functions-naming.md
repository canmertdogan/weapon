---
id: sa3
module: static-analysis
title: "Functions, Naming & Annotation"
order: 3
objectives:
  - "Identify function boundaries in a disassembly"
  - "Rename and annotate as understanding grows"
  - "Recover data types and structures from usage"
  - "Build a mental model of the program incrementally"
interactive: ""
lab: ""
duration: 20
---

## The Rename-as-You-Go Habit

A raw disassembly names everything `sub_401000`. A good analyst renames it to `check_license` once it's understood. This is not cosmetics — it's how you build a model of the program.

### Workflow

1. **Find the entry** → `main` (or `WinMain`/`DllMain`).
2. **Name the obvious** — the function that reads input, the one that prints output.
3. **Follow calls** — rename callees by what they do, not where they are.
4. **Annotate** — comment arguments, structures, and invariants as you go.
5. **Iterate** — your first names will be wrong. Rename again.

### Function Boundaries

In a disassembler, functions are delimited by:

- `push rbp / mov rbp, rsp` prologue
- `ret` / `jmp` (tail call) endings
- alignment padding (`int3` / `0xCC`) between them

Recognizing boundaries lets you think in functions, not addresses.

### Recovering Types

You can infer a variable's type from how it's used:

```asm
mov  ecx, [rax+4]     ; 4-byte access → int / DWORD
movzx eax, byte [rax] ; 1-byte zero-extend → unsigned char
movsx eax, byte [rax] ; 1-byte sign-extend → char
lea  rax, [rcx+0x10]  ; +0x10 offset → struct member
```

### Recognizing Structures

Repeated access at fixed offsets reveals a struct:

```asm
mov  rax, [rcx+0x0]   ; struct.field0
mov  rax, [rcx+0x8]   ; struct.field1
mov  rax, [rcx+0x18]  ; struct.field3 (pointer? vtable?)
```

Reconstruct the layout, give it a name, and apply it everywhere.

### Naming Conventions

| Prefix | Meaning |
|--------|---------|
| `func_` / `sub_` | function |
| `var_` | local variable |
| `arg_` | argument |
| `struct_` | structure type |
| `jmp_` / `loc_` | jump target / label |

### A Note on Tools

Ghidra and IDA track these names and propagate them to cross references. Renaming `sub_401000` to `send_beacon` instantly clarifies every call site.

## Takeaway

> Renaming is reasoning made visible. Annotate ruthlessly.

Next: **Cross References**.
