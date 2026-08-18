---
id: ar4
module: anti-re
title: "Anti-Disassembly Tricks"
order: 4
objectives:
  - "Explain overlapping instructions and why linear disassembly desyncs on them"
  - "Explain self-modifying code as an anti-static-analysis technique"
  - "Identify jump-into-the-middle-of-an-instruction tricks"
  - "Propose disassembly strategies (recursive traversal, dynamic tracing) that resist these tricks"
duration: 20
---

## When the Target Is the Disassembler Itself

Packing buys time from a curious analyst. VM obfuscation and control flow flattening bury logic under structure. This lesson's tricks go a level deeper: they exploit assumptions baked into the disassembler's decoding algorithm, so the tool itself produces a wrong listing — not just a confusing one.

### Variable-Length Encoding Is the Attack Surface

x86 instructions aren't fixed-width — a single byte can be a complete instruction, or the first byte of one that's several bytes long, and there's no universal marker separating one instruction from the next. A disassembler figures out where each instruction ends only by decoding it, then starting the next decode wherever the last one stopped. That dependency is exploitable: the exact same byte sequence decodes into completely different, unrelated instruction streams depending on which byte you start reading from.

### Overlapping Instructions

An obfuscator can hand-craft (or automatically generate) a byte sequence that forms one legitimate instruction stream when control actually flows to it at offset N, but forms a different, misleading stream when a naive linear-sweep disassembler starts decoding at N-1 or N+1. A common construction: place a junk byte immediately before the real code, designed so that real execution jumps *over* it — the CPU never touches it — while a disassembler that reads the file top-to-bottom in file order "eats" that junk byte as if it were a real opcode, then decodes everything after it at the wrong offset for the rest of the function. One misplaced byte can desynchronize disassembly for dozens of instructions downstream, all of them wrong, none of them flagged as an error.

### Self-Modifying Code

The most direct attack on static analysis: the binary patches its own `.text` bytes at runtime, so the code a disassembler reads from the file on disk is provably not the code that executes. This only works when the executing section is both writable and executable — the same **RWX** condition flagged as a red flag on its own in PE analysis, because legitimate compiler output almost never needs it. A function might decrypt or patch itself just before its first real use and revert or re-encrypt afterward, so even a debugger attached at the wrong moment sees only the disguised version. Static analysis of the on-disk bytes is, at best, analysis of a decoy.

### Jumping Into the Middle

A `jmp` or `call` can target an address one or two bytes into what a linear disassembler would have decoded as a completely different instruction — again exploiting the fact that decoding is offset-dependent. The bytes at the jump target were never meant to be reached by falling through from above; they're meant to be reached only via that specific jump, which starts decoding mid-instruction from the naive listing's point of view. A linear sweep disassembles the wrong thing at that address because it arrived there by reading sequentially, not by following the actual edge in the control flow graph.

### What Actually Resists These

All three tricks share one property: they only fool a disassembler that decodes bytes in file order and assumes each instruction's end is the next one's start. **Recursive-descent (flow-aware) disassembly** — the approach tools like Ghidra and IDA use by default — doesn't do that. It follows actual control transfer edges: decode an instruction, and if it's a jump or call, start the next decode at the *target* address, not the next sequential byte. That means it naturally lands on real code at real entry points and never wanders into the junk bytes an overlapping-instruction trick relies on being read sequentially. **Dynamic tracing** resists all three for the same underlying reason it defeats flattening — it only ever sees the bytes actually fetched and executed by the CPU, so self-modifying code, junk bytes skipped by jumps, and mid-instruction jump targets are exactly what gets recorded, correctly, because that's what really ran.

Used together — recursive disassembly for structure, dynamic tracing to confirm what's real at runtime, especially across any self-modifying regions — these two approaches close off nearly everything covered across this module: packing (dump after unpacking), VM obfuscation (map the dispatcher), flattening (trace the real path), and now the disassembler-level tricks that try to make step one impossible in the first place.

## Takeaway

> Every trick in this module targets an assumption some analysis tool makes. Follow control flow instead of file order, and most of those assumptions stop mattering.
