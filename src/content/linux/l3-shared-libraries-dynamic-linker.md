---
id: l3
module: linux
title: "Shared Libraries & the Dynamic Linker"
order: 3
objectives:
  - "Explain the .so loading process and ld.so's role"
  - "Distinguish the PLT and GOT and explain how lazy binding works"
  - "Explain how LD_PRELOAD can inject code into a process"
  - "Reason about a binary's dependencies the way ldd/readelf would show them"
duration: 20
---

## Nothing Runs Until ld.so Says So

A dynamically-linked ELF binary is incomplete on its own — it's full of calls to functions that don't exist in the file. Before `main` runs, the dynamic linker has to find every shared library the binary depends on, map them into memory, and patch up those calls. That linker is itself a program: `/lib64/ld-linux-x86-64.so.2`, named in the `PT_INTERP` segment covered in [ELF Format Deep Dive](/course/linux/l1).

### The Load Sequence

```
kernel reads PT_INTERP           → path to ld.so
kernel maps ld.so, jumps to it   → ld.so takes over, NOT the target binary
ld.so reads PT_DYNAMIC           → DT_NEEDED entries = library dependency list
ld.so resolves each dependency   → searches DT_RPATH/RUNPATH, LD_LIBRARY_PATH,
                                    /etc/ld.so.cache, default paths
ld.so maps each .so (PT_LOAD)    → same segment-mapping process as the main binary
ld.so performs relocations       → patches addresses now that everything's mapped
ld.so jumps to the real entry    → the target binary's e_entry finally runs
```

This is a genuine chicken-and-egg bootstrap: the kernel doesn't resolve libraries at all — it maps the interpreter and gets out of the way. Everything after that is `ld.so` doing the work in userspace, which is also why `ld.so`'s own behavior (search paths, preloading) is so exploitable.

### PLT and GOT: How a Call Gets Resolved

Calling a function in another shared library can't be a direct `call` — the address isn't known until load time (and with ASLR, it changes every run). Two tables solve this:

- **GOT** (Global Offset Table) — an array of pointers, one per external symbol, that gets patched with the real resolved address.
- **PLT** (Procedure Linkage Table) — small stub functions your code actually calls; each stub jumps through its GOT entry.

With **lazy binding** (the default), a GOT entry starts out pointing back into the PLT itself, not at the real function:

```
call printf@plt
  → jmp [GOT entry for printf]     ; first call: GOT still points into the PLT
  → push resolver-index
  → jmp ld.so's resolver           ; resolver finds printf's real address,
                                    ;   writes it into the GOT entry, jumps there
; every SUBSEQUENT call to printf@plt jumps straight to the real function —
; the GOT entry now points directly at libc's printf
```

This is why you'll see a call to `printf@plt` in a disassembly rather than a direct call to libc — the PLT stub is a permanent trampoline, but after the first call the GOT it jumps through points straight at the resolved function. `LD_BIND_NOW=1` (or a binary built with `-z now`, "full RELRO") disables this and resolves everything up front, trading startup latency for making the GOT immutable and read-only after load — a hardening measure against exactly the kind of GOT overwrite attacks this table structure invites.

### LD_PRELOAD: Injection Through the Front Door

`ld.so` will load libraries named in the `LD_PRELOAD` environment variable *before* anything in `DT_NEEDED`, and symbols from preloaded libraries take priority when resolving the same name elsewhere:

```
LD_PRELOAD=./fake_malloc.so ./target
```

If `fake_malloc.so` exports a function called `malloc`, every call to `malloc` anywhere in `target` — including inside libc itself — resolves to the preloaded version first. This is a legitimate technique (function interposition for profiling, sandboxing, hot-patching a broken library) and a common malware/rootkit persistence trick (a preloaded `.so` that wraps `readdir` or `open` to hide files, functioning much like a Windows API hook installed via `SetWindowsHookEx` or IAT patching). Recognizing an `LD_PRELOAD` environment variable, or a `/etc/ld.so.preload` entry, as part of a process's environment is a first-class artifact to check during triage.

### Reading Dependencies Like ldd/readelf

`ldd ./binary` (or `readelf -d ./binary`) walks the `DT_NEEDED` entries in `.dynamic` and resolves each one:

```
$ ldd ./sample
    linux-vdso.so.1 (0x00007ffd...)
    libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f...)
    /lib64/ld-linux-x86-64.so.2 (0x00007f...)
```

Each `DT_NEEDED` string is just a library name (not a path) — resolution order and final path are determined at load time by `ld.so`'s search rules, which is exactly the mechanism `LD_PRELOAD` and `LD_LIBRARY_PATH` hijack. An unusually short or unusually long dependency list, a dependency resolved from an unexpected path, or a missing library `ldd` can't find are all worth flagging before you go any further with the binary.

## Takeaway

> The PLT/GOT pair defers function addresses to load time so the same binary works anywhere ASLR puts it — and any mechanism that can influence what fills the GOT, like LD_PRELOAD, can hijack every call through it.
