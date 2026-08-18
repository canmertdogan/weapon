---
id: w2
module: windows
title: "Processes, Handles & Virtual Memory"
order: 2
objectives:
  - "Understand how a process is created and mapped"
  - "Read handles and why they matter to analysts"
  - "Interpret virtual memory regions and protection"
  - "Recognize allocation patterns used by malware"
interactive: ""
lab: ""
duration: 20
---

## A Process Is a Container

A Windows process is not code — it's a *container* holding:

- A private virtual address space (the mapped image, DLLs, heaps, stacks).
- A handle table (references to kernel objects).
- One or more threads of execution.

### Process Creation

`CreateProcess` → the kernel maps the EXE, resolves imports, creates the primary thread, and calls the entry point. DLLs load (`DllMain`) *before* the entry point runs — which is why TLS callbacks and `DllMain` are prime anti-analysis spots.

### Handles

A **handle** is an opaque index into a process's handle table, referencing kernel objects (files, processes, threads, registry keys, mutexes). To an analyst, a process's open handles reveal its intentions:

- An open handle to another process → injection target.
- A handle to `\Device\Tcp` → networking.
- A mutex handle → single-instance guard.

### Virtual Memory Regions

Each process has a flat virtual address space, divided into regions with protection:

| Region | Protection | Typical use |
|--------|-----------|-------------|
| Image + DLLs | `R-X` (code), `R--` (data) | mapped files |
| Heap | `RW-` | dynamic allocations |
| Stack | `RW-` | per-thread stacks |
| Mapped regions | varies | files, shared memory |

### Allocation Patterns to Recognize

Malware allocates memory in telltale ways:

- **`VirtualAllocEx` in another process** → injection staging.
- **A `RWX` region** → shellcode about to run.
- **`VirtualProtect` flipping `RW-` → `RX`** → self-decryption.
- **Large `VirtualAlloc` + write + execute** → unpacking stub.

In a debugger or process explorer, a sudden `RWX` region is one of the strongest "look here" signals there is.

## Takeaway

> Processes are containers; handles are intent; memory regions are the stage. Learn to read all three.

Next: **Threads, Fibers & Scheduling**.
