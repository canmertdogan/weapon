---
id: d2
module: debugging
title: "Registers & Memory Inspection"
order: 2
objectives:
  - "Read register state at a breakpoint"
  - "Interpret the flags and their meaning"
  - "Inspect and interpret memory dumps"
  - "Follow pointers through memory"
interactive: "AssemblyVisualizer"
lab: ""
duration: 20
---

## The Debugger Is a Window into State

At any pause, a debugger shows the machine's full state: registers, flags, the stack, and arbitrary memory. Reading that state is a skill.

### Registers

At a breakpoint, registers hold the *story so far*:

- **RAX** — the last computed result, or a return value.
- **RCX/RDX/R8/R9** (Win64) — the arguments to the *next* call.
- **RSP** — the top of the stack; **RBP** — the current frame.
- **RIP** — exactly where execution stopped.

### Flags

Each flag answers a yes/no question:

| Flag | Question it answers |
|------|---------------------|
| ZF | "Was the result zero?" |
| CF | "Did an unsigned operation overflow?" |
| OF | "Did a signed operation overflow?" |
| SF | "Is the result negative?" |

At a `cmp`/`test` followed by a conditional jump, the flags *are* the branch decision. Read them to predict where execution goes.

### Memory Dumps

The **dump window** shows raw memory at any address. Skills to practice:

- **Follow a pointer** — RAX holds `0x00401000`; dump that address to see the pointed-to data.
- **Find a string** — dump the address in RCX (an argument) to see if it's a filename, URL, or key.
- **Read a struct** — dump the buffer and parse fields by offset.
- **Watch the stack** — dump `RSP` to see return addresses, saved registers, and locals.

### The Loop

At every breakpoint, ask the same three questions:

1. **What are the registers?** → what just happened.
2. **What are the flags?** → which branch is next.
3. **What does memory point to?** → what data is in play.

## Interactive: Register Inspection

Step the example and read the register and flag state at each pause.

## Takeaway

> State is evidence. Read registers, flags, and memory together to reconstruct the machine's reasoning.

Next: **Execution Flow & Stepping**.
