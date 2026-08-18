---
id: d4
module: debugging
title: "Anti-Debugging & Bypass"
order: 4
objectives:
  - "Recognize common anti-debugging techniques"
  - "Detect IsDebuggerPresent and PEB checks"
  - "Bypass anti-debug with patching and conditional breaks"
  - "Understand timing and hardware-breakpoint checks"
  - "Identify self-modifying code and integrity checks"
  - "Use anti-anti-debug plugins (ScyllaHide, TitanHide)"
interactive: "DebuggerSimulator"
lab: "lab-10"
duration: 25
---

## The Debugger Arms Race

Malware tries to detect when it's being debugged and misbehave (or exit). Your job is to spot the checks and neutralize them.

### IsDebuggerPresent / PEB

The simplest check: the Windows `IsDebuggerPresent` API, which reads the `BeingDebugged` flag in the Process Environment Block (PEB).

```asm
call IsDebuggerPresent
test eax, eax
jne  detected       ; nonzero → debugger present
```

This is also readable directly:
```asm
mov rax, gs:[0x60]        ; PEB address (x64: GS:[0x60], x86: FS:[0x30])
movzx eax, byte [rax+0x2] ; BeingDebugged (offset 0x2)
```

**Bypass**: Patch `BeingDebugged` to 0 in PEB, or NOP the call.

---

### CheckRemoteDebuggerPresent

```asm
push 0                  ; pbDebuggerPresent (output)
push GetCurrentProcess()
call CheckRemoteDebuggerPresent
test eax, eax           ; API success?
je  failed
cmp byte [rsp], 0       ; *pbDebuggerPresent
jne detected
```

**Bypass**: Hook API to return 0, or patch output parameter.

---

### NtQueryInformationProcess

```asm
; ProcessDebugPort (7) / ProcessDebugFlags (31) / ProcessDebugObjectHandle (30)
push 0                  ; ReturnLength
push 4                  ; ProcessInformationLength
lea rax, [rsp+debug_info]
push rax                ; ProcessInformation
push 7                  ; ProcessInformationClass (DebugPort)
push -1                 ; ProcessHandle (current)
call NtQueryInformationProcess
test eax, eax           ; NTSTATUS
jne failed
; DebugPort != -1 → debugger attached
```

**Classes**:
- `ProcessDebugPort` (7): Returns port handle (nonzero = debugged)
- `ProcessDebugFlags` (31): Returns flags (0 = debugged, 1 = no debug)
- `ProcessDebugObjectHandle` (30): Returns debug object handle

---

### NtGlobalFlag / ProcessHeap

- `NtGlobalFlag` in PEB (offset 0xBC in x64, 0x68 in x86) = `0x70` under debugger
- Heap flags at `PEB->ProcessHeap` (x64 offsets, matching the `gs:[0x60]` code below — x86 uses 0x40/0x44 instead):
  - `Flags` (offset 0x70): `HEAP_GROWABLE (2) | HEAP_DEBUG (0x80000000)` under debugger
  - `ForceFlags` (offset 0x74): `HEAP_DEBUG (0x80000000)` under debugger

```asm
mov rax, gs:[0x60]        ; PEB
mov eax, [rax+0xBC]       ; NtGlobalFlag
test eax, 0x70
jne detected
```

---

### Timing Checks

A debugger's human stepper takes seconds between instructions. Malware measures:

```asm
rdtsc              ; read time-stamp counter
mov  ebx, eax
; ... a few instructions ...
rdtsc
sub  eax, ebx
cmp  eax, 1000     ; more than ~1000 cycles? suspicious
ja   detected
```

**Variants**:
- `QueryPerformanceCounter` / `GetTickCount` / `GetTickCount64`
- `NtQuerySystemTime` / `NtGetTickCount`
- Multiple checks at different points

**Bypass**: 
- Patch threshold comparison
- Use hardware breakpoints (no single-step overhead)
- Time-travel debugging (rr, WinDbg TTD)

---

### Hardware Breakpoint Detection

Software reads the DR0–DR3 debug registers; nonzero means a hardware breakpoint is set:

```asm
mov  rax, dr7
test rax, rax
jne  detected
```

Or by calling `GetThreadContext`/`SetThreadContext` (`NtGetContextThread`/`NtSetContextThread`) with the `CONTEXT_DEBUG_REGISTERS` flag to read DR0–DR7 directly.

**Bypass**: 
- Use software breakpoints (INT3 / 0xCC) instead
- Clear DR0-DR3 via context manipulation
- ScyllaHide hooks `NtGetContextThread`

---

### Self-Modifying Code / Integrity Checks

Code computes its own checksum and compares:

```asm
; Compute checksum of .text section
mov rcx, text_start
mov rdx, text_end
call calculate_crc32
cmp eax, expected_crc
jne tampered
```

**Detection**: Break on write to `.text` (hardware BP on write). Check for `VirtualProtect` making `.text` writable.

**Bypass**: Patch the comparison, or compute correct checksum after your patches.

---

### TLS Callbacks (Pre-Entry Point)

```asm
; In TLS Directory (DataDirectory[9])
; AddressOfCallBacks → array of RVAs
; Each called with DLL_PROCESS_ATTACH before main
```

Can run anti-debug before you can set breakpoints at entry.

**Bypass**: 
- Set breakpoint on `LdrInitializeThunk` / `LdrpCallInitRoutine`
- Patch TLS callback array to zero
- Use "Break on DLL Load" for ntdll

---

### Exception-Based Checks

```asm
; Force exception, check if debugger handles it
xor eax, eax
div eax              ; #DE (divide by zero)
; If debugger: exception caught
; If no debugger: process crashes
```

Or `INT 2Dh` / `INT 3` with specific handling.

---

## Bypassing Anti-Debug: Three Approaches

### 1. Patch It Out

Change the conditional jump:
- `JNE` (6 bytes: `0F 85 xx xx xx xx`) → `90 90 90 90 90 90` (NOP it out so execution just falls through)
- Or invert: `JNE` → `JE` (`0F 85` → `0F 84`)

### 2. Spoof the Value

At the check, force the register/flag to the "clean" value:
- `EAX = 0` after `IsDebuggerPresent`
- `ZF = 1` after `TEST EAX, EAX`

In x64dbg: Right-click register → "Set to 0"

### 3. Hide the Debugger

Tools that hook/kernel-patch to hide debugger artifacts:
- **ScyllaHide** (x64dbg plugin) — user-mode hooks
- **TitanHide** — kernel driver (more robust)
- **Phant0m** — PPL killer for AV/EDR

---

## Anti-Anti-Debug Workflow

1. **Run without debugger** — does it work? (Baseline)
2. **Attach debugger** — where does it break/differ?
3. **Search for patterns**:
   - `IsDebuggerPresent`, `CheckRemoteDebuggerPresent`
   - `NtQueryInformationProcess` with class 7/30/31
   - `PEB` access (`gs:[0x60]`)
   - `RDTSC` / `QueryPerformanceCounter`
   - `DR0`-`DR7` / `NtGetContextThread`
   - `TLS` callbacks
4. **Patch / Spoof / Hide** each check
5. **Verify** — re-run, ensure functionality intact

---

## Interactive: Anti-Debug Demo


The simulator models `IsDebuggerPresent` returning 1 (debugger detected). Step through to see the branch, then reason about how you'd bypass it.

---

## Takeaway

> Anti-debug is just a branch. Find it, and you can force either path.

**Lab 10**: Anti-Debug Bypass → [Anti-Debug Bypass](/labs/lab-10)

---

## Practice Exercises

1. **PEB Walk**: In x64dbg, dump `gs:[0x60]` → find `BeingDebugged`, `NtGlobalFlag`, `ProcessHeap`. What are the values?
2. **Timing Bypass**: You see `rdtsc` / `sub` / `cmp eax, 0x1000` / `ja detected`. How to bypass without patching?
3. **TLS Hunt**: Check DataDirectory[9] in a packed sample. Are there callbacks? Set BP on `LdrpCallInitRoutine`.
4. **ScyllaHide Config**: Enable all hooks. Attach to a known anti-debug sample (e.g., UPX with `-d` flag removed). Does it run?
5. **Integrity Check**: Find `VirtualProtect(.text, RWX)` followed by checksum. Patch the `JNE` after compare.
6. **Custom Check**: A binary calls `GetTickCount` at start, stores it, calls again before sensitive op, compares delta > 5000ms. How to defeat?