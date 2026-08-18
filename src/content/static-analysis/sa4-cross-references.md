---
id: sa4
module: static-analysis
title: "Cross References"
order: 4
objectives:
  - "Use XREFs to find who calls a function"
  - "Trace data references to their readers and writers"
  - "Build a call graph to understand program structure"
  - "Locate the code that references an interesting string"
interactive: "ControlFlowVisualizer"
lab: "lab-06"
duration: 20
---

## XREFs Are the Backbone of Static Analysis

A **cross reference** (XREF) is a pointer from one location to another. Disassemblers compute them automatically: select any function, string, or address and list every place that references it.

### Call XREFs: Who Calls This Function?

You found `sub_401200` (a suspicious function). Ask: *who calls it?*

- A single call site from `main` → it's part of the normal flow.
- Many call sites → a utility used throughout.
- No call sites (called via pointer) → might be an export or callback.

### Data XREFs: Who Reads This String?

You found the string `"http://c2.example.com"` at `0x402000`. The XREF list shows it's loaded in `sub_401500`. Now you've located the C2 routine — without reading any unrelated code.

This is the classic workflow:

> **Interesting string → XREF → function → understand → rename.**

### Building a Call Graph

A call graph (functions as nodes, calls as edges) shows the program's skeleton at a glance:

```
main
├── init
│   └── config
├── validate
│   └── network   (taken on success)
└── cleanup
```

- **Deep chains** = layered logic.
- **Hubs** (many callers) = central utilities (memory, logging, crypto).
- **Islands** (disconnected) = suspicious — possibly obfuscated or unused.

### XREFs and Obfuscation

Malware tries to hide XREFs:

- **Dynamic resolution** (`GetProcAddress`) — no static XREF to the API.
- **Indirect calls** (`call [rax+0x18]`) — target resolved at runtime.
- **Encrypted strings** — decrypted in place, so no string XREF exists.

The *absence* of expected XREFs is itself evidence of obfuscation.

## Interactive: Call Graph

Click through the call graph below to see how functions connect. Hubs vs. leaves tell you where the core logic lives.

## Takeaway

> XREFs turn a disassembly from a flat list into a navigable graph. Follow them.

**Lab 6**: Cross-Reference Tracing → [Cross-Reference Tracing](/labs/lab-06)
