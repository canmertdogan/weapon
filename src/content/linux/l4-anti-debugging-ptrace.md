---
id: l4
module: linux
title: "Linux Anti-Debugging & ptrace"
order: 4
objectives:
  - "Explain how ptrace(PTRACE_TRACEME) detects an attached debugger"
  - "Read /proc/self/status TracerPid as a detection technique"
  - "Explain timing-based and signal-based anti-debug tricks on Linux"
  - "Propose a bypass strategy for each detection technique covered"
duration: 20
---

## Same Arms Race, Different Primitive

[Windows anti-debugging](/course/debugging/d4) revolves around `IsDebuggerPresent` and PEB flags. Linux has no equivalent API — instead, every trick exploits a property of `ptrace`, the single syscall that both debuggers *and* self-checking binaries are built on. Learn `ptrace`'s rules and you understand every detection technique on this page at once.

### ptrace(PTRACE_TRACEME): Only One Tracer Allowed

The kernel enforces a hard rule: **a process can only be traced by one tracer at a time.** A binary can exploit this defensively by calling `ptrace(PTRACE_TRACEME, ...)` on itself, early, before any real analysis begins:

```c
if (ptrace(PTRACE_TRACEME, 0, 0, 0) == -1) {
    // call failed → we're already being traced by a debugger
    exit(1);
}
// call succeeded → we just became our own tracer, and now
// no OTHER process (like gdb) can attach to us at all
```

If GDB is already attached when this runs, the call fails (`-1`, `errno == EPERM`) because the process is already being traced — that failure *is* the detection. If nothing is attached yet, the call succeeds and the process has just made itself untraceable by anyone else for the rest of its life, since the one-tracer slot is now filled. Either branch defeats a naive attach attempt.

### /proc/self/status: TracerPid

Simpler and far more common in practice — every process can read its own tracer state directly from procfs:

```
$ cat /proc/self/status | grep TracerPid
TracerPid:	0
```

`TracerPid` is `0` when nothing is attached, and the tracer's PID otherwise. A binary just needs to parse this file (or the equivalent `/proc/<pid>/status`) and branch on whether the value is nonzero — functionally identical in spirit to reading `PEB->BeingDebugged` on Windows, just via a text file instead of a struct field:

```c
FILE *f = fopen("/proc/self/status", "r");
// ... read lines, find "TracerPid:", parse the number ...
if (tracer_pid != 0) { /* debugger attached */ }
```

### Timing Checks

Identical logic to the Windows `rdtsc` trick: single-stepping through a debugger is orders of magnitude slower than native execution, so a binary times a short block of code and treats an outlier as evidence of a debugger:

```c
struct timespec t1, t2;
clock_gettime(CLOCK_MONOTONIC, &t1);
// ... a handful of instructions ...
clock_gettime(CLOCK_MONOTONIC, &t2);
long delta_ns = /* t2 - t1 */;
if (delta_ns > THRESHOLD) { /* too slow — probably debugged */ }
```

`rdtsc` works directly on Linux too; `clock_gettime` is just the portable libc wrapper malware authors often prefer since it doesn't stand out in a syscall trace the way a raw `rdtsc` instruction does in a disassembly.

### Signal-Based Tricks

A debugger intercepts signals before the debuggee's own handler normally would. Two consequences a binary can exploit:

- **SIGTRAP self-delivery** — raise `SIGTRAP` (`kill(getpid(), SIGTRAP)`) and check whether a registered handler actually ran. Under a debugger, the debugger catches the trap first and the handler may never fire (or fires differently), depending on how the debugger is configured to forward signals.
- **Handler presence checks** — install a `SIGTRAP` or `SIGSEGV` handler and deliberately fault; a debugger conventionally intercepts these before userspace, so the fault "not reaching" the handler the way it should is itself the signal.

### Bypass Strategies

| Technique | Bypass |
|-----------|--------|
| `PTRACE_TRACEME` self-trace | Patch the call out (NOP it), or hook `ptrace` at the libc level to always return success |
| `TracerPid` in `/proc/self/status` | Intercept the `open`/`read` on that path (via `LD_PRELOAD`, see [l3](/course/linux/l3)) and rewrite the value to `0` |
| Timing checks | Patch out the branch, or use a debugger plugin that lies about elapsed time between breakpoints |
| Signal-based checks | Configure the debugger to pass signals through untouched (GDB: `handle SIGTRAP nostop noprint pass`), or patch the check |

The common thread across every bypass: **find the exact value the check wants to observe, and force the binary to observe it** — whether that means patching a branch, hooking a syscall, or preloading a library that lies about `/proc`.

## Takeaway

> Every Linux anti-debug trick is a variation on one question — "is ptrace watching me right now?" — asked through a different door; find the door and you find the check.
