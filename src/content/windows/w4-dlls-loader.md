---
id: w4
module: windows
title: "DLLs & the Loader"
order: 4
objectives:
  - "Trace how the loader resolves and maps DLLs"
  - "Understand DllMain, TLS callbacks, and their timing"
  - "Recognize DLL hijacking and search-order attacks"
  - "Read forwarded exports and delay-loads"
interactive: "HexViewer"
lab: "lab-12"
duration: 20
---

## DLLs Are Shared Code

A DLL (Dynamic-Link Library) is code loaded into a process's address space and mapped into memory. The loader resolves imports against DLLs at process start.

### The Load Sequence

1. Map the EXE.
2. Walk its import table; for each DLL, map it and resolve its exports.
3. Recursively resolve the DLLs' own imports.
4. Call each DLL's `DllMain( DLL_PROCESS_ATTACH )`.
5. Call the EXE's entry point.

### DllMain and TLS Callbacks

`DllMain` runs **before** the process entry point, and TLS callbacks run even earlier. Both are common spots for anti-analysis and early decryption — code that runs before your debugger's entry breakpoint.

### DLL Search Order

When loading a DLL by name, Windows searches in a specific order. The **classic hijack**: place a malicious DLL where it will be found first, and the loader maps yours instead of the real one.

The order includes (varies by `SafeDllSearchMode`): the application directory → system directories → `%PATH%`. An attacker who can drop a DLL in the app directory owns the load.

### Forwarded Exports

An export can be a **forwarder** — a string pointing to another DLL's function (`KERNEL32.FunctionName`). The loader follows the forwarder. In a dump, a forwarded export looks like a string, not an address.

### Delay-Loaded DLLs

Delay-load means a DLL is not loaded until its first call. Useful for optional dependencies — and for malware, a way to hide an import from static triage (it only appears when the code path runs).

## Interactive: Imports & Exports

The PE's import table lists the DLLs and functions. Read the names to infer what the binary links against.

## Takeaway

> DLL loading is a chain of trust. Understand the order, and you understand hijacking.

**Lab 12**: DLL Import & Load Order → [DLL Import & Load Order](/labs/lab-12)
