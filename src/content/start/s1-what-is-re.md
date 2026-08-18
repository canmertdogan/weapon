---
id: s1
module: start
title: "What is Reverse Engineering?"
order: 1
objectives:
  - Define reverse engineering in the context of software
  - Distinguish between static and dynamic analysis
  - "Understand the RE workflow: acquire → analyze → document"
  - Map RE to real-world use cases (malware, vuln research, interop)
interactive: ""
lab: ""
duration: 10
---

Reverse engineering is the process of **understanding a system through observation and deduction** without access to its original design documents or source code.

In software, this means analyzing compiled binaries to reconstruct logic, data structures, and behavior.

## Two Fundamental Approaches

### Static Analysis
Examining the binary *without executing it*. Tools: disassemblers (Ghidra, IDA Pro), decompilers, hex editors.
- Fast, safe, scales to large codebases
- Cannot resolve runtime values (pointers, decrypted strings, dynamic imports)

### Dynamic Analysis
Observing the binary *during execution*. Tools: debuggers (x64dbg, GDB), tracers, sandboxes.
- Reveals actual runtime behavior, decrypted data, anti-analysis tricks
- Slower, requires controlled environment, may miss untaken paths

**Real RE workflows blend both continuously.** You static-analyze to form hypotheses, dynamic-analyze to test them, then refine.

## The Investigation Loop

```
HYPOTHESIS → OBSERVE → REASON → INVESTIGATE → DOCUMENT
     ↑                                                          ↓
     ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

Every RE session follows this cycle. The course teaches you to execute each step deliberately.

## Why This Course Exists

Most resources teach *tools* or *terminology*. WEAPON teaches **methodology**.

You won't just learn "what a CALL instruction does." You'll learn:

> "You found an unknown CALL. How do you determine what function it invokes, what arguments it receives, and why that function matters?"

That question — and the systematic answer — is what separates a tool user from a reverse engineer.