---
id: w5
module: windows
title: "Windows API & Native Layer"
order: 5
objectives:
  - "Navigate the Win32 → Native (NT) API stack"
  - "Recognize the most analysis-relevant APIs"
  - "Understand syscalls and ntdll"
  - "Trace suspicious API chains"
interactive: "HexViewer"
lab: "lab-13"
duration: 25
---

## The API Stack

Windows exposes multiple layers:

```
Application
   └─ Win32 API     (kernel32.dll, user32.dll, advapi32.dll ...)
        └─ Native API  (ntdll.dll — Nt/Zw functions)
             └─ syscall  (into the kernel)
```

Most programs call Win32; the Win32 functions forward to `ntdll`'s native functions, which make the actual syscalls.

### Why the Layers Matter

- **Win32** is documented and stable; it's what imports show.
- **Native (ntdll)** is semi-documented; `NtCreateFile`, `NtAllocateVirtualMemory`, etc.
- **Syscalls** are numbered per-version; direct syscall malware bypasses ntdll hooks.

When a binary imports from `ntdll.dll` directly (or makes raw syscalls), it's trying to stay below the Win32 surface — a common evasion technique.

### The Analysis-Relevant APIs

| Category | APIs |
|----------|------|
| Process injection | `OpenProcess`, `VirtualAllocEx`, `WriteProcessMemory`, `CreateRemoteThread`, `NtCreateThreadEx` |
| Persistence | `RegSetValueEx`, `CreateService`, `SetFileAttributes` |
| C2 / network | `InternetOpen`, `InternetConnect`, `WSAStartup`, `connect` |
| Crypto | `CryptAcquireContext`, `CryptEncrypt`, `BCryptEncrypt` |
| Anti-analysis | `IsDebuggerPresent`, `CheckRemoteDebuggerPresent`, `GetTickCount` |
| File ops | `CreateFile`, `ReadFile`, `WriteFile`, `DeleteFile` |

### Tracing a Suspicious Chain

Don't read imports in isolation — read them as a **narrative**:

```
VirtualAllocEx → WriteProcessMemory → CreateRemoteThread
```

That's a sentence: "allocate, write, execute" — injection. Reading the chain tells you *what* the binary does; the strings and XREFs tell you *why*.

### Direct Syscalls

Advanced malware emits `syscall` instructions directly (or calls `ntdll` stubs with `syscall` numbers), avoiding import-table visibility and user-mode hooks. Detection requires inspecting `ntdll` or watching for `syscall` instructions in unusual locations.

## Interactive: Import Chains

The PE below shows a set of imports. Read the names as a capability narrative.

## Takeaway

> The API is a language. Learn the vocabulary, and imports read like sentences.

**Lab 13**: Suspicious API Chains → [Suspicious API Chains](/labs/lab-13)
