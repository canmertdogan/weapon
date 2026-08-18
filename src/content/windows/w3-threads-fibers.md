---
id: w3
module: windows
title: "Threads, Fibers & Scheduling"
order: 3
objectives:
  - "Distinguish threads, fibers, and jobs"
  - "Understand thread context and why it matters"
  - "Recognize injection via thread creation"
  - "Read synchronization primitives (mutexes, events)"
interactive: ""
lab: ""
duration: 20
---

## Threads Are the Execution Units

A thread is what actually runs code. A process can host many threads. Each thread has its own:

- **Stack** — for locals and return addresses.
- **Context** — registers, including RIP and RSP.
- **Thread Environment Block (TEB)** — thread-local data (and the PEB is reachable from it).

### The Thread Context

A thread's **context** is its full register snapshot. `GetThreadContext` / `SetThreadContext` read/write it. This is the mechanism behind:

- **`CreateRemoteThread`** — start a thread *in another process* (injection).
- **`QueueUserAPC`** — queue a function to run in a target thread.
- **Hijacking** — suspend a thread, rewrite its RIP, resume it.

Any API that manipulates *another* process's thread context is injection-adjacent.

### Fibers

Fibers are cooperative user-mode "threads" scheduled by the program, not the kernel. `ConvertThreadToFiber` / `SwitchToFiber` swap execution contexts manually. Malware uses fibers to hide execution flow from tools that only track threads.

### Jobs and Scheduling

**Jobs** group processes and can limit them (CPU, memory). Analysts see jobs when a sandbox or a service controls a process tree.

### Synchronization Primitives

Named objects coordinate across processes and are themselves IOCs:

| Object | Purpose | Malware use |
|--------|---------|-------------|
| Mutex | mutual exclusion | single-instance guard (name = IOC) |
| Event | signaling | coordination between threads |
| Semaphore | counting | resource limiting |
| Named pipe | IPC | local C2 / privilege handoff |

A named mutex like `Global\MalwareGuard_7F3A` is both an indicator and a persistence/anti-double-run marker.

## Takeaway

> Injection is thread manipulation. Learn the thread APIs, and you can spot every injection primitive.

Next: **DLLs & the Loader**.
