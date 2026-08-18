---
id: l5
module: linux
title: "GDB & Linux Tooling"
order: 5
objectives:
  - "Set breakpoints and inspect registers/memory in GDB"
  - "Use strace/ltrace to observe syscalls and library calls without a debugger"
  - "Use objdump/readelf to statically inspect an ELF from the command line"
  - "Build a Linux-native static-plus-dynamic analysis workflow"
duration: 15
---

## The Linux Toolbox Lives in the Terminal

Windows RE leans on GUI tools — x64dbg, Ghidra, PE-bear. Linux has GUI options too, but its native workflow is command-line first: a handful of small, composable tools that each do one job well. Knowing them fluently is the difference between a five-minute triage and a slow afternoon.

### GDB: Breakpoints, Registers, Memory

```
gdb ./sample
(gdb) break *0x401020        # breakpoint at an address
(gdb) break main             # breakpoint at a symbol
(gdb) run                    # start execution
(gdb) info registers         # dump rax, rbx, rip, ...
(gdb) x/10i $rip             # disassemble 10 instructions at rip
(gdb) x/8xg $rsp             # examine 8 giant (8-byte) words at the stack pointer
(gdb) stepi / nexti          # single-step, stepping over / into calls
(gdb) continue
```

GDB's text UI (`layout asm`, `layout regs`) gets you something closer to x64dbg's live disassembly-plus-registers view without leaving the terminal. For anything beyond basic stepping, the `pwndbg` or `gef` extensions add heap inspection, pointer chain visualization, and cleaner memory dumps on top of stock GDB.

### strace / ltrace: Observe Without a Debugger

Sometimes you don't need to stop the process — you need to watch what it does. `strace` uses `ptrace` under the hood to log every syscall a process makes:

```
$ strace ./sample
execve("./sample", ["./sample"], 0x7ffd...) = 0
mmap(NULL, 8192, PROT_READ|PROT_WRITE, ...) = 0x7f...
openat(AT_FDCWD, "/etc/passwd", O_RDONLY) = 3
read(3, "root:x:0:0...", 4096)          = 1847
connect(4, {sa_family=AF_INET, ...}, 16) = 0
```

That's a file read followed by a network connection, visible without opening a disassembler at all. `ltrace` does the equivalent for library calls (`malloc`, `strcpy`, `printf`) resolved through the [PLT](/course/linux/l3), useful for spotting suspicious string handling or crypto library usage. Both are the fastest way to answer "what does this thing actually touch" before committing to deeper static analysis — and both are exactly what a `PTRACE_TRACEME` self-trace (see [l4](/course/linux/l4)) is trying to block, since `strace` also needs that one tracer slot.

### objdump / readelf: Static Inspection From the Shell

```
$ readelf -h ./sample          # ELF header fields — e_type, e_entry, e_phnum...
$ readelf -l ./sample          # program headers (segments)
$ readelf -S ./sample          # section headers
$ readelf -d ./sample          # dynamic section — DT_NEEDED libraries
$ objdump -d ./sample          # full disassembly
$ objdump -d -M intel ./sample # disassembly in Intel syntax
$ nm ./sample                  # symbol table (if not stripped)
$ strings ./sample             # printable strings — quick triage
$ file ./sample                # format, architecture, static/dynamic, stripped?
```

`readelf -h` and `-l` map directly onto everything from [ELF Format Deep Dive](/course/linux/l1) — this is the command-line equivalent of the hex-viewer walkthrough in that lesson, and the fastest way to confirm `ET_DYN` vs `ET_EXEC`, `e_phnum`, or a `PT_INTERP` path without opening a hex editor at all.

### A Static-Plus-Dynamic Workflow

1. **`file` + `readelf -h`** — confirm architecture, `ET_DYN`/`ET_EXEC`, stripped or not.
2. **`strings` + `readelf -d`** — quick triage: interesting strings, library dependencies.
3. **`objdump -d`** — static disassembly; locate `main`, look for anti-debug patterns from [l4](/course/linux/l4).
4. **`strace`/`ltrace`** — run it (in an isolated VM) and observe syscalls/library calls without committing to a full debug session.
5. **`gdb`** — when something needs a closer look, breakpoint it and inspect registers/memory directly.

Static tools narrow down *where* to look; `strace`/`ltrace` show *what* it does cheaply; GDB is for when you need to stop time and look closely. Reach for the cheapest tool that answers the question.

## Takeaway

> Linux RE is a pipeline of small sharp tools, not one big application — file, readelf, objdump, strace, and gdb each answer a different question, and chaining them is the workflow.
