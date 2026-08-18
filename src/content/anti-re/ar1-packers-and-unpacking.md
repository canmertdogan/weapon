---
id: ar1
module: anti-re
title: "Packers & Unpacking"
order: 1
objectives:
  - "Explain what a packer does and why SizeOfImage vs. on-disk file size is a static tell"
  - "Identify a packer's decompression stub versus the payload it decompresses"
  - "Explain the find-OEP-then-dump manual unpacking strategy"
  - "Distinguish packing (compression/obfuscation) from encryption-based protection"
interactive: "HexViewer"
lab: "lab-22"
duration: 25
---

## Identification Was the Easy Part

[Packer identification](/course/malware/m4) — spotting `UPX!`, high-entropy sections, a tiny import table — tells you a binary is packed. It doesn't hand you the real code. That takes a methodology: find the point where the packer finishes unpacking itself, then extract what it built. This lesson is that methodology.

### Stub and Payload Are Different Things

A packed file is really two programs glued together:

```
On disk:    [ Stub (native code, small) ][ Payload (compressed/encrypted blob) ]
At runtime: Stub executes → inflates payload into fresh memory → payload executes
```

The **stub** is what the file's real `AddressOfEntryPoint` points to. It's small, generic, and often shared across thousands of unrelated packed samples — the same UPX or custom-crypter stub wraps completely different malware families. The **payload** is the original compiled program: whatever the malware author actually wrote, compressed or encrypted so it doesn't resemble itself on disk. Confusing the two wastes analysis time — disassembling the stub tells you about the packer, not the malware.

### SizeOfImage Doesn't Lie

The Optional Header field `SizeOfImage` states the total virtual memory footprint the loader must reserve once the file is mapped in. A packer has to declare enough virtual space to hold the *decompressed* payload, even though the *on-disk* sections are still small and compressed. That mismatch — a modest file size next to a `SizeOfImage` that reserves several times more address space than the visible sections account for — is itself a static giveaway, independent of entropy or signatures. Something is going to grow into that reserved space at runtime, and it isn't going to be legitimate padding.

### Finding the OEP

The **Original Entry Point (OEP)** is where the *payload's* own code begins — the instruction the compiler originally emitted as the program's entry, before any packer touched the file. Manual unpacking is the process of running the stub just long enough to let it do its job, then stopping at the exact moment control transfers to the OEP:

1. **Set a breakpoint at the file's declared entry point** (the stub) and start execution there, single-stepping or using step-over on calls you don't need to enter.
2. **Watch for the tail-end transfer** — packers decompress into memory, then hand off control with a single `jmp` or `call` whose target lands far outside the stub's own code region, often in a freshly-allocated or newly-writable page.
3. **Use known stub idioms as landmarks.** Classic x86 packers save the entire register state on entry with `pushad` and restore it with `popad` immediately before the jump to OEP — that `popad` followed by an indirect jump is one of the most reliable "you're about to hit OEP" signals in unpacking.
4. **Confirm you've arrived** by checking that execution is now in a region that looks like compiler output — real strings, sane function prologues, imports being resolved — not stub logic.

### Dumping and Fixing Imports

Once execution is sitting at OEP with the payload fully decompressed in memory, the unpacking work becomes memory forensics: dump the process's memory region (or the full image) to a new file, then reconstruct a valid PE from it — fixing section headers to match what's actually resident, and rewriting `AddressOfEntryPoint` to the OEP you found.

The hardest part is almost always the **Import Address Table**. Packers frequently null out or obfuscate the IAT before packing and rebuild it dynamically at runtime via `LoadLibrary`/`GetProcAddress` calls hidden in the stub, so the dumped image's import table doesn't point at anything useful. Rebuilding it — walking the resolved-but-unlabeled addresses in memory and matching them back to named imports — is what turns a memory dump into a binary that will actually load and run standalone.

### Packing Is Not Encryption-Grade Protection

Packing (UPX-style compression, simple XOR/RC4 stub decryption) is designed to defeat *static* analysis — it does nothing once the code is running, because the whole point is to decompress into plain, executable machine code that the CPU can run directly. Anything that reaches OEP and gets dumped is fully recoverable.

**Crypters and commercial protectors** (Themida, VMProtect) raise the bar differently: runtime-derived or licensing-server-issued keys mean the decrypted payload may never fully materialize in a dumpable form, integrity checks detect and react to memory tampering, and anti-debug/anti-tamper logic can crash or silently corrupt the payload the moment a debugger attaches. "Just find OEP and dump" assumes the payload sits still in memory long enough to copy — protectors are built specifically to violate that assumption. Later lessons in this module (virtualization, control flow flattening) are the tools that make that possible.

## Interactive: Stub vs. Payload

The hex view below shows a packed binary's entry region. Locate the stub's `pushad`/`popad` bracket and the tail jump that would hand off to OEP — that jump target is the boundary between "packer code" and "the actual program."

## Takeaway

> The stub is a lock, not a wall — run it, catch the moment it opens, and dump what's behind it.

**Lab 22**: Manual Unpacking Challenge → [Manual Unpacking Challenge](/labs/lab-22)
