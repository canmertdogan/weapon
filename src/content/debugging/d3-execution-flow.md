---
id: d3
module: debugging
title: "Execution Flow & Stepping"
order: 3
objectives:
  - "Use step-into, step-over, and step-out correctly"
  - "Trace a loop's iteration count and exit condition"
  - "Read a call stack backtrace"
  - "Avoid stepping traps (anti-debug, library code)"
interactive: "DebuggerSimulator"
lab: "lab-09"
duration: 20
---

## Stepping Is Controlled Execution

Breakpoints answer "what's here?" Stepping answers "what happens next?" The three stepping primitives:

| Command | Action |
|---------|--------|
| **Step Into** | Execute one instruction, descending into any `call`. |
| **Step Over** | Execute one instruction, but *run* a `call` to completion. |
| **Step Out** | Run until the current function returns. |

### When to Use Each

- **Step Into** — when you need to see inside a function you care about.
- **Step Over** — when the next call is library noise (`printf`, `memcpy`) you don't need to trace.
- **Step Out** — when you've seen enough of this function and want its caller.

Stepping into `printf` is the classic beginner trap — you end up in thousands of CRT instructions. Step *over* it.

### Tracing Loops

```asm
loop:
  add  eax, ecx
  sub  ecx, 1
  cmp  ecx, 0
  jne  loop
```

Stepping this 100 times is slow. Instead:

- Set a breakpoint *after* the loop, then run.
- Or set a conditional breakpoint (`ecx == 0`) inside the loop.
- Or mentally trace: this is a sum; the answer is closed-form.

Learn to **skim** loops, not step them.

### The Call Stack

At any pause, the **call stack** shows the chain of active functions:

```
kernel32!WriteFile
  └─ app!send_data
      └─ app!main
```

Each frame has a return address — where execution resumes when that function returns. The backtrace tells you *how you got here*, which is often more useful than *where here is*.

## Interactive: Stepping

The program is a small loop. Step through it, or set a breakpoint at `ret` and Run to skip the loop entirely.

## Takeaway

> Step to *verify*, not to *discover*. Use breakpoints to jump, stepping to confirm.

**Lab 9**: Execution Trace → [Execution Trace](/labs/lab-09)
