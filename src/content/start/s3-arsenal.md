---
id: s3
module: start
title: "Setting Up Your Arsenal"
order: 3
objectives:
  - Provision a safe, isolated analysis VM
  - Install and configure Ghidra, x64dbg, and essential utilities
  - Verify toolchain with a known sample
  - "Establish workflow habits: snapshots, notes, naming conventions"
interactive: ""
lab: "lab-00"
duration: 20
---

## The Golden Rule

**Never analyze malware on your host machine.** Ever.

## VM Setup (Windows 10/11, 64-bit)

1. **VirtualBox / VMware** — Enable snapshots *before* first sample
2. **Allocate**: 4+ GB RAM, 2+ vCPU, 80+ GB disk
3. **Network**: Host-only adapter (no internet) + NAT for updates only
4. **Shared folders**: Disabled. Use drag-drop or ISO for file transfer

### Inside the VM

| Tool | Purpose | Install Notes |
|------|---------|---------------|
| **Ghidra** | Primary static analysis (NSA, free, Java-based) | JDK 17+, `ghidraRun.bat` |
| **x64dbg** | Primary dynamic analysis (Windows, open source) | Install `x64dbg` + `x32dbg` |
| **Cutter** | Alternative GUI for Radare2 (cross-platform) | Good for ELF/PE triage |
| **Sysinternals Suite** | Process Explorer, ProcMon, Strings, Autoruns | Microsoft official |
| **010 Editor / HxD** | Professional hex editors | 010 has templates |
| **PE-bear / CFF Explorer** | PE structure visualization | Quick header checks |
| **Python 3.11+** | Scripting, automation, `pefile`, `capstone` | `pip install pefile capstone lief` |
| **WSL2 (Ubuntu)** | Linux ELF analysis, `radare2`, `gdb` | Optional but recommended |

## Ghidra First-Time Config

1. **File → Preferences → Tool** → Enable "Show addresses in all windows"
2. **Analysis → Default Options** → Enable "Aggressive Instruction Finder"
3. **Create a project per engagement** — Not one giant project
4. **Learn keyboard shortcuts**: `L` (label), `;` (comment), `/` (search), `G` (go to)

## x64dbg First-Time Config

1. **Options → Preferences → Events** → Break on: `System breakpoint`, `Entry breakpoint`, `DLL entry`
2. **Customize toolbar**: Add `Run to cursor`, `Follow in dump`, `Analyze`
3. **Symbols**: Configure Microsoft symbol server (`SRV*C:\Symbols*https://msdl.microsoft.com/download/symbols`)

## Verification Lab: Lab 00

Before moving on, confirm your environment is ready. Lab 00 runs a quick browser-based toolchain check — no sample download needed.

**Checks:**
- [ ] Ghidra launches and can open a PE file
- [ ] x64dbg installs and breaks at the entry point
- [ ] `strings` extracts both ASCII and UTF-16 from a sample
- [ ] PE-bear shows a valid PE header with no packer signature

**If all pass → Your arsenal is ready.**

→ [Open Lab 00: Toolchain Verification](/labs/lab-00)

## Workflow Habits (Start Now)

- **Snapshot before every sample** — Name: `pre-<sample>-<date>`
- **Note template**: `sample.md` with sections: Overview, Strings, Imports, Entry, Hypotheses, Findings, IOCs
- **Naming convention**: `func_<address>`, `var_<offset>`, `struct_<purpose>` — Rename *as you understand*
- **Export often**: Ghidra → File → Export Program → JSON/Ghidra project for portability

## What's Next

Module 01: **Foundations**. We dissect the binary format itself — the container every executable lives in.