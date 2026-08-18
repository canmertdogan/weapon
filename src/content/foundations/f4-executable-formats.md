---
id: f4
module: foundations
title: "Executable Formats"
order: 4
objectives:
  - "Deep-dive PE: DOS/NT headers, section table, Data Directories"
  - Parse Import Address Table (IAT) and understand loader binding
  - Analyze Export Directory for DLL capabilities
  - Understand Base Relocations and TLS callbacks
  - Interpret Load Config for modern mitigations (CFG, CET, SafeSEH)
  - Manually walk PE structures in a hex editor
interactive: "HexViewer"
lab: "lab-02"
duration: 20
---

## PE Deep Dive

The PE format is the **contract between the binary and the Windows loader**.

### Data Directories (Optional Header, offset 0x70 in PE32+)

```c
IMAGE_DATA_DIRECTORY DataDirectory[16] = {
  [0]  = Exports,          // What this binary provides
  [1]  = Imports,          // What this binary needs
  [2]  = Resource,         // Icons, manifests, version info
  [3]  = Exception,        // .pdata (unwind info)
  [4]  = Security,         // Authenticode signature
  [5]  = BaseReloc,        // Fixups for ASLR
  [6]  = Debug,            // PDB path, timestamp
  [7]  = Architecture,     // Reserved
  [8]  = GlobalPtr,        // RISC
  [9]  = TLS,              // Thread Local Storage callbacks
  [10] = LoadConfig,       // CFG, CET, Guard CF
  [11] = BoundImport,      // Pre-bound IAT timestamps
  [12] = IAT,              // Runtime-resolved import addresses
  [13] = DelayImport,      // Load on first call
  [14] = COMDescriptor,    // .NET metadata
  [15] = Reserved
};
```

**Each directory = { RVA, Size }**. Zero = not present.

---

## Imports: The Dependency Graph

```
Import Directory (RVA from DataDirectory[1])
  └─ Array of IMAGE_IMPORT_DESCRIPTOR (terminated by all-zero)
       ├─ OriginalFirstThunk → RVA of INT (Import Name Table)
       ├─ TimeDateStamp
       ├─ ForwarderChain
       ├─ Name → RVA of DLL name string (e.g., "KERNEL32.DLL")
       └─ FirstThunk → RVA of IAT (Import Address Table)
```

### INT vs IAT

| Table | Purpose | When Populated |
|-------|---------|----------------|
| **INT** (Import Name Table) | Array of `IMAGE_THUNK_DATA` — function names/ordinals | Static (in file) |
| **IAT** (Import Address Table) | Same structure — *overwritten by loader* with resolved addresses | Runtime |

**Before load**: IAT = copy of INT (hints + names)
**After load**: IAT = actual function pointers (e.g., `0x7FFB12345678`)

### IMAGE_THUNK_DATA (64-bit)

```
Bit 63: 1 = Ordinal import (low 16 bits = ordinal)
Bit 63: 0 = Name import (low 31 bits = RVA of IMAGE_IMPORT_BY_NAME)
```

```c
struct IMAGE_IMPORT_BY_NAME {
  WORD Hint;      // Suggested ordinal (optimization)
  CHAR Name[];    // Null-terminated ASCII function name
};
```

### Loader Binding Process

1. **Load DLL**: `LoadLibraryEx` for each imported DLL
2. **Resolve Exports**: For each thunk in INT:
   - If ordinal: `GetProcAddress` by ordinal
   - If name: `GetProcAddress` by name (uses hint as optimization)
3. **Write IAT**: Overwrite `FirstThunk` entries with resolved addresses
4. **Handle Forwarders**: If export is forwarder (`DLLNAME.Function`), recursively resolve

### Bound Imports (DataDirectory[11])

- Pre-computed IAT values from a previous run
- Stores `TimeDateStamp` of target DLL
- Loader verifies timestamp matches → uses bound values (fast path)
- Mismatch → falls back to normal resolution

### Delay Imports (DataDirectory[13])

- DLL loaded on **first call** to any function from that DLL
- Uses `DelayLoadInfo` hook for custom handling
- Useful for optional dependencies (plugins, rare features)
- Structure: `ImgDelayDescr` array → similar to Import Descriptor

---

## Exports: The Public API

```
Export Directory (DataDirectory[0])
  ├─ Characteristics (unused)
  ├─ TimeDateStamp
  ├─ Major/Minor Version
  ├─ Name RVA → DLL name string
  ├─ Ordinal Base (starting ordinal, usually 1)
  ├─ NumberOfFunctions (total)
  ├─ NumberOfNames (named exports)
  ├─ AddressOfFunctions RVA → EAT (Export Address Table) [RVAs]
  ├─ AddressOfNames RVA → ENT (Export Name Table) [RVAs to strings]
  └─ AddressOfNameOrdinals RVA → EOT (Export Ordinal Table) [WORDs]
```

### Export Lookup Algorithm

```
1. Hash function name (or use provided ordinal)
2. Binary search ENT (Export Name Table) for name
3. Index found → EOT[Index] = ordinal hint (0-based)
4. Actual ordinal = OrdinalBase + EOT[Index]
5. EAT[ActualOrdinal - OrdinalBase] = function RVA
```

**Forwarded Exports**: EAT entry is an RVA to a string `"DLLNAME.FunctionName"` — loader recursively resolves.

### Export Analysis for Malware

- **DLL name** in export directory = identity (e.g., `CORE.DLL` vs `kernel32.dll`)
- **Ordinal-only exports** = no names, harder to analyze statically
- **Forwarded exports** = proxy DLLs, API sets (Windows 10+)
- **NumberOfNames << NumberOfFunctions** = many internal/ordinal-only functions

---

## Base Relocations: ASLR Fixups

When loader maps image at `ActualBase != ImageBase`:

```
Base Reloc Directory (DataDirectory[5])
  └─ Array of IMAGE_BASE_RELOCATION_BLOCK
       ├─ PageRVA (4KB page base)
       ├─ BlockSize
       └─ Array of WORD (Type + Offset)
            Type: HIGH 4 bits (usually 0xA = IMAGE_REL_BASED_DIR64)
            Offset: LOW 12 bits (offset within page)
```

### Relocation Types (PE32+)

| Type | Value | Description |
|------|-------|-------------|
| IMAGE_REL_BASED_ABSOLUTE | 0 | Skip (padding) |
| IMAGE_REL_BASED_HIGH | 1 | High 16 bits |
| IMAGE_REL_BASED_LOW | 2 | Low 16 bits |
| IMAGE_REL_BASED_HIGHLOW | 3 | 32-bit (PE32) |
| **IMAGE_REL_BASED_DIR64** | **10 (0xA)** | **64-bit (PE32+)** |

### Fixup Formula

```c
Delta = ActualBase - ImageBase
*(uint64_t*)(ActualBase + PageRVA + Offset) += Delta
```

**Why it matters**: Without relocations, ASLR breaks the binary. Packers often strip relocations to hinder analysis.

---

## TLS Callbacks: Code Before `main`

```
TLS Directory (DataDirectory[9])
  ├─ StartAddressOfRawData / EndAddressOfRawData / AddressOfIndex
  └─ AddressOfCallBacks → RVA of array of callback RVAs (null-terminated)
```

### Callback Signature

```c
VOID NTAPI TlsCallback(
  PVOID DllHandle,    // Module base
  DWORD Reason,       // DLL_PROCESS_ATTACH, THREAD_ATTACH, etc.
  PVOID Reserved
);
```

### Execution Order

1. **Process Attach** (DLL_PROCESS_ATTACH) — before entry point
2. **Thread Attach** (DLL_THREAD_ATTACH) — per thread
3. **Thread Detach** (DLL_THREAD_DETACH) — per thread
4. **Process Detach** (DLL_PROCESS_DETACH) — at exit

### Malware Uses

- **Anti-debug**: Check `BeingDebugged` before entry point
- **Decryption**: Unpack/decrypt `.text` before execution
- **Integrity**: Verify no breakpoints/hardware BP set
- **Evasion**: Execute in TLS to bypass entry-point breakpoints

**Detection**: Check DataDirectory[9] ≠ 0, parse callback array.

---

## Load Config: Modern Mitigations (DataDirectory[10])

```
Load Config Directory (DataDirectory[10])
  ├─ SecurityCookie → /GS stack cookie
  ├─ SEHandlerTable / SEHandlerCount → SafeSEH
  ├─ GuardCFCheckFunctionPointer / GuardCFDispatchFunctionPointer → CFG
  ├─ GuardCFFunctionTable / GuardCFFunctionCount → Valid call targets
  ├─ GuardFlags → CFG, CET, XFG flags
  ├─ CodeIntegrity → Code integrity options
  ├─ GuardAddressTakenIatEntryTable → XFG
  └─ ... (CET shadow stack, RFG, etc.)
```

### Key Mitigations

| Mitigation | Fields | Purpose |
|------------|--------|---------|
| **SafeSEH** | SEHandlerTable, SEHandlerCount | Validated exception handlers |
| **CFG** (Control Flow Guard) | GuardCF*, GuardCFFunctionTable, GuardFlags & 0x100 | Indirect call validation |
| **CET** (Control-flow Enforcement) | GuardFlags & 0x200, ShadowStack | Hardware-enforced CFI |
| **XFG** (eXtended Flow Guard) | GuardFlags & 0x400, GuardXFG* | Type-based indirect call check |
| **RFG** (Return Flow Guard) | GuardFlags & 0x800 | Return address validation |
| **/GS** (Stack Cookie) | SecurityCookie | Stack buffer overflow detection |

### Load Config Versions

| Version | Size | Added |
|---------|------|-------|
| 0 | 0x48 | Basic (/GS, SafeSEH) |
| 1 | 0x58 | CFG |
| 2 | 0x70 | CET, RFG |
| 3 | 0x98 | XFG, Hybrid PE, etc. |

**Analysis Tip**: Check `GuardFlags` — reveals compiler/linker version and enabled mitigations.

---

## Interactive: PE Structure Explorer


**Explore**: Click Data Directory entries → jump to structures. Decode IAT entries. Find TLS callbacks.

---

## Takeaway

> The PE header is a **dependency manifest + relocation map + mitigation config**. Read it like a spec sheet.

**Lab 2**: Identify suspicious imports → [Suspicious API Identification](/labs/lab-02)

---

## Practice Exercises

1. **IAT Walk**: In the hex viewer, locate DataDirectory[1] → parse Import Descriptors → find `KERNEL32.DLL` → enumerate its `FirstThunk` entries.
2. **Bound Import Check**: Does this binary have Bound Imports (DataDirectory[11])? What does the timestamp tell you?
3. **TLS Hunt**: Check DataDirectory[9]. If non-zero, parse the callback array. What runs before `main`?
4. **Relocation Math**: Given `ImageBase=0x140000000`, `ActualBase=0x7FF700000000`, and a `DIR64` fixup at `PageRVA=0x1000, Offset=0x20` — what's the patched value if original was `0x140001234`?
5. **Load Config Decode**: Parse DataDirectory[10]. What `GuardFlags` are set? Is CFG enabled? CET? XFG?
6. **Export Forwarding**: Find a forwarded export in a system DLL (e.g., `kernel32.dll` → `ntdll.dll`). Trace the resolution chain.