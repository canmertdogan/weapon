---
id: d1
module: debugging
title: "Breakpoints"
order: 1
objectives:
  - "Set software and hardware breakpoints"
  - "Choose breakpoint locations strategically"
  - "Understand how a debugger pauses execution"
  - "Use conditional and API breakpoints"
interactive: "DebuggerSimulator"
lab: "lab-08"
duration: 20
---

## A Debugger Pauses the Machine

A debugger gives you control over a process at the instruction level. The core primitive is the **breakpoint**: a marker that halts execution when reached.

### Software Breakpoints

The debugger writes an `int3` (0xCC) instruction over the target instruction. When the CPU executes it, a trap is raised and control returns to the debugger.

```asm
0x00401000:  mov  eax, 1     ; ← set breakpoint here
0x00401005:  add  eax, 2
```

The debugger replaces `mov eax, 1` with `int3`, runs the process, and on the trap restores the original byte and pauses.

### Hardware Breakpoints

The CPU's debug registers (DR0–DR3) can break on an address **without modifying code**. Only 4 available, but they work on read/write access too — essential for watchpoints on self-modifying or ROM'd code.

### Choosing Where to Break

Don't break randomly. Break at:

- **Entry point** — the process's true start.
- **API calls** — set a breakpoint on `CreateFileW`, `RegSetValueEx`, etc., and you stop *before* the call, with arguments in registers.
- **Interesting strings** — find the string, set a breakpoint on the code that reads it (via XREFs).
- **Function boundaries** — to observe arguments and return values.

### Conditional Breakpoints

Break only when a condition holds:

```
break at 0x401100 when eax == 0x1f
```

Saves you from stepping through thousands of iterations of a loop.

### API Breakpoints

Modern debuggers can break on an API *name* and show you the call with its resolved arguments — the fastest way to observe what a binary actually does with the OS.

## Interactive: Debugger Simulator

Set a breakpoint by clicking a line, then press **Run**. The program executes until your breakpoint. Step through the rest.

## Takeaway

> A breakpoint is a targeted question: "what does the machine look like exactly here?" Ask good ones.

**Lab 8**: Where to Break → [Where to Break](/labs/lab-08)
