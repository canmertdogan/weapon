---
id: l2
module: linux
title: "Processes & Syscalls"
order: 2
objectives:
  - "Explain the fork/exec model for creating Linux processes"
  - "Explain how a syscall transitions from userspace to the kernel (the syscall instruction)"
  - "Read /proc/<pid>/maps to understand a process's memory layout"
  - "Identify common syscalls (execve, ptrace, mmap) relevant to reverse engineering"
duration: 20
---

## Every Linux Process Is Born Twice

Windows has `CreateProcess`, one call that does everything. Linux splits process creation into two distinct steps, and that split shapes how you reason about every process tree you'll ever inspect.

### fork() Then exec()

```
fork()   duplicate the calling process — new PID, copy-on-write memory,
         same code, same open file descriptors, execution resumes
         in BOTH parent and child right after the call

exec()   replace the CURRENT process image with a new program —
         same PID, but new code/data/stack; nothing survives except
         open file descriptors (unless FD_CLOEXEC is set)
```

A shell running `ls` does `fork()` to get a child process, then that child calls `execve("/bin/ls", ...)` to become `ls` without spawning a third process. This is why `ps` shows parent/child relationships that make sense: every process except PID 1 was `fork`ed from something, and most immediately `exec`'d into something else. `vfork` and `clone` are optimized/parameterized variants of the same idea — `clone` in particular is what Linux threads are built from, sharing the address space instead of copying it.

### The syscall Instruction

A syscall is how userspace asks the kernel to do something it isn't allowed to do directly: open a file, allocate memory, send a signal. On x86-64 Linux, the mechanism is the `syscall` instruction:

```asm
mov rax, 59       ; syscall number for execve
mov rdi, path     ; arg1
mov rsi, argv     ; arg2
mov rdx, envp     ; arg3
syscall           ; trap into kernel mode
```

`rax` holds the syscall number, arguments go in `rdi, rsi, rdx, r10, r8, r9` (note: `r10` instead of `rcx` — the C calling convention's `rcx` slot is clobbered by the `syscall` instruction itself), and the return value comes back in `rax`. The CPU switches privilege rings, the kernel's syscall handler dispatches on the number in `rax`, does the work, and `sysret` hands control back. This is the one, narrow gate between userspace and kernel — every anti-debug check, every file read, every network call eventually funnels through it, which is exactly why tracing syscalls is such a powerful analysis technique (more in the [Anti-Debugging](/course/linux/l4) and tooling lessons).

### Reading /proc/<pid>/maps

Every running process exposes its own memory layout as a pseudo-file:

```
555555554000-555555555000 r-xp 00000000 08:01 1234  /usr/bin/sample
555555754000-555555755000 rw-p 00000000 08:01 1234  /usr/bin/sample
7ffff7dc0000-7ffff7de5000 r-xp 00000000 08:01 5678  /lib/x86_64-linux-gnu/libc.so.6
7ffff7fc0000-7ffff7fc4000 rw-p 00000000 00:00 0                        [heap]
7ffffffde000-7ffffffff000 rw-p 00000000 00:00 0                        [stack]
```

Each line is a mapped region: address range, permissions (`rwxp`/`rwxs`), file offset, device, inode, and backing file (or `[heap]`, `[stack]`, or blank for anonymous memory). This is the direct, ground-truth answer to "where does each `PT_LOAD` segment from [the ELF header](/course/linux/l1) end up, and where did the dynamic linker put `libc`?" It's also where you look for a suspiciously `rwx` region, a library mapped without a backing file, or ASLR-shifted base addresses in a live process.

### Syscalls Worth Knowing for RE

| Syscall | Purpose | Why it matters |
|---------|---------|-----------------|
| `execve` | replace process image | how every program actually starts running |
| `fork` / `clone` | create process/thread | process tree reconstruction |
| `ptrace` | debug/trace another process | both how debuggers work *and* a self-debugging anti-debug trick |
| `mmap` | map memory (files or anonymous) | how segments, shared libraries, and packers' unpacked payloads get memory |
| `mprotect` | change page permissions | a `RW → RX` transition is a strong unpacking/self-modification signal |
| `ptrace(PTRACE_TRACEME)` | mark self as traced | classic Linux anti-debug — see the next lesson |

## Takeaway

> Every Linux process exists because something called fork, then exec; every privileged action it takes funnels through one instruction, `syscall` — trace that one gate and you see everything the process does.
