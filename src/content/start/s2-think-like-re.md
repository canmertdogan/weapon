---
id: s2
module: start
title: "How to Think Like a RE"
order: 2
objectives:
  - Adopt hypothesis-driven analysis over blind enumeration
  - Learn to ask "why does this exist?" not just "what is this?"
  - Build a mental model of compiler patterns and idioms
  - Develop a personal methodology for unknown binaries
interactive: ""
lab: ""
duration: 15
---

## The Tool Trap

Beginners collect tools: Ghidra, IDA, x64dbg, Cutter, Radare2, Binary Ninja.
Experts collect **questions**.

A tool shows you bytes. A question tells you *which bytes matter*.

## Hypothesis-Driven Analysis

Don't start by reading every function. Start with a question:

> "How does this binary validate the license key?"

Then:
1. **Locate** — Find strings, imports, UI references pointing to validation
2. **Hypothesize** — "It probably calls a crypto function, then compares"
3. **Test** — Set breakpoints, trace arguments, observe results
4. **Conclude** — Document the algorithm, not just the address

## Compiler Patterns as Leverage

Compilers are predictable. Learn their fingerprints:

| Pattern | What It Reveals |
|---------|-----------------|
| `mov eax, [rbp-4]` / `cmp eax, 0` / `je` | `if (local_var == 0)` |
| `lea rdi, [rip+offset]` / `call` | Function with string argument |
| `sub rsp, 0x30` / `mov [rsp+0x20], reg` | Stack frame with saved registers |
| `xor eax, eax` / `ret` | Function returning 0/NULL |
| `mov ecx, 0x10` / `rep movsb` | `memcpy` / `strcpy` inline |

**Recognize patterns → Skip reading instruction-by-instruction.**

## The RE Mindset

1. **Assume nothing** — Verify every assumption against the binary
2. **Work backwards** — From interesting behavior to root cause
3. **Document ruthlessly** — Rename functions, annotate structures, write comments *as you go*
4. **Embrace uncertainty** — "I don't know yet" is a valid state. Flag it, move on, return later.

## Your First Heuristic

When you open an unknown binary:

1. `strings` — What does it talk about? (C2 domains, error messages, crypto constants)
2. `imports` — What capabilities does it request? (Network, crypto, persistence, anti-debug)
3. `entry point` — Where does execution actually start?
4. `sections` — Unusual permissions? Packed? Overlay data?

This 5-minute triage directs hours of analysis. Master it first.