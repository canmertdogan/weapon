---
id: f3
module: foundations
title: "Memory Layout"
order: 3
objectives:
  - Diagram virtual memory layout (user/kernel split)
  - Explain stack vs heap vs data vs code segments
  - Understand ASLR, DEP/NX, and their bypass implications
  - Visualize stack frame anatomy (prologue/epilogue)
interactive: "StackVisualizer"
lab: ""
duration: 15
---

## Virtual Memory Map (x86-64 Windows)

```
0x00000000`00000000
│
├─ [Unmapped / Null pointer guard]          ~64 KB
│
├─ User Space (0x00000000`00010000 → 0x00007FFF`FFFFFFFF)
│   ├─ Process EXE image (base + sections)  ASLR slide
│   ├─ DLLs (mapped at random bases)        ASLR slide
│   ├─ Heap(s)                              Grows ↑
│   ├─ Memory mappings (files, shared mem)  Random
│   ├─ Thread Stacks (1 MB default)         Grows ↓
│   │   └─ Guard pages at bottom
│   └─ TEB / PEB                            Fixed offsets
│
├─ [Unmapped / Canonical gap]               0x00008000`00000000 → 0xFFFF0000`00000000
│
└─ Kernel Space (0xFFFF0000`00000000 → 0xFFFFFFFF`FFFFFFFF)
    ├─ Kernel image, drivers, pools
    ├─ System PTEs, PFN database
    └─ Hal / Hypervisor reserved
```

**Canonical address requirement**: Bits 63:48 must be sign-extension of bit 47.
- User: `0x0000...` → `0x00007FFF`...
- Kernel: `0xFFFF...` → `0xFFFFFFFF`...

## Stack Anatomy

```
HIGH ADDRESS
┌─────────────────────────────┐
│ Caller's Frame              │
├─────────────────────────────┤
│ Return Address (RIP)        │ ← Pushed by CALL
├─────────────────────────────┤
│ Saved RBP (Caller's RBP)    │ ← Pushed by callee prologue
├─────────────────────────────┤
│ Shadow Space (Win64: 32B)   │ ← Reserved for register spill
├─────────────────────────────┤
│ Local Variables             │ ← [RBP - offset]
│   var_1                     │
│   var_2                     │
├─────────────────────────────┤
│ Saved Non-Volatile Regs     │ ← RBX, RDI, RSI, R12-R15
├─────────────────────────────┤
│ Stack Alignment Padding     │ ← 16-byte alignment before CALL
├─────────────────────────────┤
│ Arguments 5+ (on stack)     │
├─────────────────────────────┤
│ Return Address (to caller)  │
LOW ADDRESS
```

### Prologue / Epilogue Pattern

```asm
; PROLOGUE
push rbp              ; Save caller's frame pointer
mov  rbp, rsp         ; Establish our frame pointer
sub  rsp, 0x50        ; Allocate locals + alignment + shadow space
; ... save non-volatile regs if used ...
; mov [rbp-0x10], rbx

; FUNCTION BODY

; EPILOGUE
; ... restore non-volatile regs ...
add  rsp, 0x50        ; Deallocate
pop  rbp              ; Restore caller's RBP
ret                   ; Pop RIP, jump
```

**Optimized builds may omit RBP frame pointer** (`-fomit-frame-pointer`). Locals addressed via `[rsp+offset]`. Harder to read, faster to execute.

## Heap

- **Process heap**: `HeapCreate` / `HeapAlloc` (Windows), `malloc` (CRT)
- **LFH (Low-Fragmentation Heap)**: Default on modern Windows, bucket-based
- **Segments**: 1 MB chunks committed on demand
- **Metadata**: `HEAP_ENTRY` headers before each allocation (vulnerable to corruption)

## Protections & Implications

| Protection | Mechanism | Bypass Relevance |
|------------|-----------|------------------|
| **ASLR** | Randomize base addresses (EXE, DLLs, heap, stack) | Info leak → compute slide |
| **DEP / NX** | Mark pages non-executable (RW→RX transition) | ROP, JOP, `VirtualProtect` |
| **CFG** | Validate indirect call targets (bitmap) | CFG-aware ROP, `SetProcessValidCallTargets` |
| **CET** | Shadow stacks + IBT (Indirect Branch Tracking) | Hardware-enforced, harder |
| **Stack Cookies** | `/GS` canary between locals and saved RBP | Leak cookie, or overwrite exception handler |

## Interactive: Stack Frame Explorer


**Click through**: Watch `push rbp` / `mov rbp,rsp` / `sub rsp,0x30` build the frame. Hover locals to see offsets.

## Takeaway

> Memory is not flat. It's a structured, permissioned, randomized landscape. The stack is a disciplined stack. The heap is a chaotic allocator. Both leave forensic traces.

Next: **Executable Formats** — PE deep dive: imports, exports, relocations, TLS, and how the loader stitches it all together.