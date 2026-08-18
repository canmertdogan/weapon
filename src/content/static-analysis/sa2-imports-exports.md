---
id: sa2
module: static-analysis
title: "Imports & Exports"
order: 2
objectives:
  - "Read the Import Address Table (IAT)"
  - "Infer capabilities from imported APIs"
  - "Understand how exports reveal a DLL's public surface"
  - "Detect missing or obfuscated imports"
interactive: "HexViewer"
lab: "lab-05"
duration: 15
---

## Imports Are a Capability Manifest

A binary must import every API it calls (unless it resolves them dynamically). The import table therefore enumerates a program's *capabilities* — before you read a single instruction.

### Reading the Import Table

The PE Import Directory lists, per DLL, the functions requested:

```
KERNEL32.dll
  ├─ VirtualAllocEx      → process memory allocation
  ├─ WriteProcessMemory  → code injection
  ├─ CreateRemoteThread  → execution in another process
  └─ ...
```

### Capability Clusters

| Imports | Capability |
|---------|-----------|
| `CreateRemoteThread` + `VirtualAllocEx` + `WriteProcessMemory` | process injection |
| `RegSetValueEx` + `RegCreateKeyEx` | persistence |
| `InternetOpen` + `InternetConnect` | C2 communication |
| `CryptEncrypt` + `CryptDecrypt` | encryption |
| `CreateToolhelp32Snapshot` + `Process32Next` | process enumeration |
| `SetWindowsHookEx` | keylogging |

A single API is weak evidence; a **cluster** is a smoking gun.

### Imports vs Dynamic Resolution

Malware often avoids the import table (visible to static analysis) and instead calls `GetProcAddress` + `LoadLibrary` to resolve APIs at runtime. Then the import table shows only `GetProcAddress` — itself a red flag.

### Exports: What a DLL Provides

The Export Directory lists the functions a DLL makes available. Reading a DLL's exports tells you its public API surface — and whether a name is forwarded (`KERNEL32.FunctionName`).

### IAT at Runtime

Before load, the IAT mirrors the names. After load, the loader overwrites each entry with a resolved address. In a dump, real addresses in the IAT confirm the binary ran and which DLLs mapped where.

## Interactive: Import Table

The PE below has its import table in `.rdata`. Highlight the section and read the imported function names.

## Takeaway

> Imports are the binary's résumé. Read them before the code.

**Lab 5**: Import Table Analysis → [Import Table Analysis](/labs/lab-05)
