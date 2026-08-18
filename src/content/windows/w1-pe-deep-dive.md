---
id: w1
module: windows
title: "PE Format Deep Dive"
order: 1
objectives:
  - "Map every PE header structure and its purpose"
  - "Read the Data Directory array"
  - "Understand section permissions and their security impact"
  - "Detect anomalies (RWX sections, malformed headers)"
  - "Manually parse PE structures in a hex editor"
  - "Identify packer/modification artifacts"
interactive: "HexViewer"
lab: "lab-11"
duration: 25
---

## The PE Is the Loader's Contract

Windows reads the PE structure to map the file into memory, resolve imports, apply relocations, and begin execution. Reading it fluently is the foundation of Windows RE.

### The Layout, End to End

```
DOS Header        "MZ" + e_lfanew → pointer to NT headers
NT Headers        "PE\0\0" + COFF + Optional Header
Optional Header   entry point, image base, alignments, Data Directories
Section Table     name, size, RVA, file offset, permissions
Sections          .text, .rdata, .data, .reloc, ...
```

### DOS Header (64 bytes)

| Offset | Field | Size | Description |
|--------|-------|------|-------------|
| 0x00 | e_magic | 2 | "MZ" (0x5A4D) |
| 0x3C | **e_lfanew** | **4** | **Offset to NT Headers (critical!)** |

The stub at 0x40 typically prints "This program cannot be run in DOS mode". Space between 0x40 and e_lfanew = **classic hiding spot**.

---

### NT Headers

**Signature** (4 bytes): `PE\0\0` (0x00004550)

**File Header (COFF)** (20 bytes):

| Offset | Field | Size | Values |
|--------|-------|------|--------|
| 0x00 | Machine | 2 | 0x8664 (x64), 0x014c (x86), 0xAA64 (ARM64) |
| 0x02 | NumberOfSections | 2 | Count of section headers |
| 0x04 | TimeDateStamp | 4 | Unix timestamp (linker) — often forged |
| 0x08 | PointerToSymbolTable | 4 | COFF debug (usually 0) |
| 0x0C | NumberOfSymbols | 4 | COFF debug (usually 0) |
| 0x10 | SizeOfOptionalHeader | 2 | 0xE0 (PE32), 0xF0 (PE32+) |
| 0x12 | Characteristics | 2 | Flags: 0x0002=EXE, 0x2000=DLL, 0x0020=LargeAddrAware |

---

### Optional Header (PE32+ = 0xF0 bytes)

| Offset | Field | Size | Description |
|--------|-------|------|-------------|
| 0x00 | Magic | 2 | 0x10B (PE32), 0x20B (PE32+), 0x107 (ROM) |
| 0x02 | Linker Version | 2 | Major/Minor |
| 0x04 | SizeOfCode | 4 | Sum of executable sections |
| 0x08 | SizeOfInitializedData | 4 | Sum of initialized data |
| 0x0C | SizeOfUninitializedData | 4 | Sum of .bss |
| **0x10** | **AddressOfEntryPoint** | **4** | **RVA of entry point** |
| 0x14 | BaseOfCode | 4 | RVA of .text |
| 0x18 | ImageBase | 8 | Preferred load address (e.g., 0x140000000) |
| 0x20 | SectionAlignment | 4 | Memory alignment (0x1000) |
| 0x24 | FileAlignment | 4 | Disk alignment (0x200) |
| 0x28 | OS Version | 4 | Major/Minor |
| 0x2C | Image Version | 4 | Major/Minor |
| 0x30 | Subsystem Version | 4 | Major/Minor |
| 0x34 | Win32VersionValue | 4 | Reserved (0) |
| 0x38 | SizeOfImage | 4 | Total memory size (SectionAlignment aligned) |
| 0x3C | SizeOfHeaders | 4 | Headers + section table (FileAlignment aligned) |
| 0x40 | CheckSum | 4 | PE checksum (rarely verified) |
| 0x44 | Subsystem | 2 | 1=Native, 2=GUI, 3=CUI, 9=WinCE |
| 0x46 | **DllCharacteristics** | **2** | **Mitigation flags** |
| 0x48 | SizeOfStackReserve | 8 | Stack reserve |
| 0x50 | SizeOfStackCommit | 8 | Stack commit |
| 0x58 | SizeOfHeapReserve | 8 | Heap reserve |
| 0x60 | SizeOfHeapCommit | 8 | Heap commit |
| 0x68 | LoaderFlags | 4 | Reserved (0) |
| 0x6C | NumberOfRvaAndSizes | 4 | Always 16 |
| **0x70** | **DataDirectory[16]** | **128** | **Critical directories** |

---

### DllCharacteristics (Offset 0x46) — Mitigation Flags

| Flag | Value | Meaning |
|------|-------|---------|
| DYNAMIC_BASE | 0x0040 | ASLR enabled |
| NX_COMPAT | 0x0100 | DEP enabled (NX) |
| NO_SEH | 0x0400 | No structured exception handlers |
| NO_BIND | 0x0800 | Do not bind imports |
| APPCONTAINER | 0x1000 | AppContainer (UWP) |
| WDM_DRIVER | 0x2000 | WDM driver |
| GUARD_CF | 0x4000 | **Control Flow Guard (CFG)** |
| TERMINAL_SERVER_AWARE | 0x8000 | Terminal Server aware |

**CET/Guard flags** (Load Config Directory, DataDirectory[10]):
- CET: not a `GuardFlags` bit at all — signaled by the separate `DllCharacteristicsEx` field, `IMAGE_DLLCHARACTERISTICS_EX_CET_COMPAT` (0x1) — Shadow stacks, IBT
- XFG: `IMAGE_GUARD_XFG_ENABLED` (0x00800000) — Type-based CFI
- RFG: `IMAGE_GUARD_RF_INSTRUMENTED` (0x00020000) / `IMAGE_GUARD_RF_ENABLE` (0x00040000) / `IMAGE_GUARD_RF_STRICT` (0x00080000) — Return Flow Guard

---

### The Data Directory Array (16 Entries)

Each entry: `{ RVA (4 bytes), Size (4 bytes) }`. Zero = absent.

| Index | Name | Purpose | Section |
|-------|------|---------|---------|
| 0 | Export | Functions provided | `.edata` |
| **1** | **Import** | **Functions needed (IAT)** | **`.idata`** |
| 2 | Resource | Icons, manifests, version | `.rsrc` |
| 3 | Exception | `.pdata` unwind info | `.pdata` |
| 4 | Security | Authenticode signature | (not in sections) |
| **5** | **BaseReloc** | **ASLR fixups** | **`.reloc`** |
| 6 | Debug | PDB path, timestamp | `.rdata` |
| 7 | Architecture | Reserved | — |
| 8 | GlobalPtr | RISC | — |
| **9** | **TLS** | **Thread Local Storage callbacks** | **`.tls`** |
| **10** | **LoadConfig** | **CFG, CET, SafeSEH, cookies** | **`.rdata`** |
| 11 | BoundImport | Pre-bound IAT timestamps | `.rdata` |
| **12** | **IAT** | **Runtime-resolved import addresses** | **`.idata`** |
| 13 | DelayImport | Load on first call | `.didat` |
| 14 | COMDescriptor | .NET metadata | `.cormeta` |
| 15 | Reserved | — | — |

---

### Section Table (IMAGE_SECTION_HEADER) — 40 bytes each

| Offset | Field | Size | Description |
|--------|-------|------|-------------|
| 0x00 | Name | 8 | Null-padded (".text\0\0\0") |
| 0x08 | VirtualSize | 4 | Size in memory |
| 0x0C | VirtualAddress | 4 | RVA in memory |
| 0x10 | SizeOfRawData | 4 | Size on disk (FileAlignment) |
| 0x14 | PointerToRawData | 4 | File offset (FileAlignment) |
| 0x18 | PointerToRelocations | 4 | COFF (obj files) |
| 0x1C | PointerToLinenumbers | 4 | COFF |
| 0x20 | NumberOfRelocations | 2 | COFF |
| 0x22 | NumberOfLinenumbers | 2 | COFF |
| **0x24** | **Characteristics** | **4** | **Permissions + flags** |

---

### Section Characteristics (Flags)

| Flag | Value | Meaning |
|------|-------|---------|
| CNT_CODE | 0x00000020 | Contains code |
| CNT_INITIALIZED_DATA | 0x00000040 | Contains initialized data |
| CNT_UNINITIALIZED_DATA | 0x00000080 | Contains uninitialized data (.bss) |
| **MEM_EXECUTE** | **0x20000000** | **Executable (X)** |
| **MEM_READ** | **0x40000000** | **Readable (R)** |
| **MEM_WRITE** | **0x80000000** | **Writable (W)** |
| ALIGN_1BYTES | 0x00100000 | 1-byte align |
| ALIGN_64BYTES | 0x00500000 | 64-byte align |
| LNK_NRELOC_OVFL | 0x01000000 | Relocations overflow |
| MEM_DISCARDABLE | 0x02000000 | Discardable (e.g., .reloc) |
| MEM_NOT_CACHED | 0x04000000 | Not cached |
| MEM_NOT_PAGED | 0x08000000 | Not paged |
| MEM_SHARED | 0x10000000 | Shared |

**Common Combinations**:
- `.text` (code): 0x60000020 = R+X+CODE
- `.rdata` (read-only data): 0x40000040 = R+INIT_DATA
- `.data` (read-write data): 0xC0000040 = R+W+INIT_DATA
- `.bss` (uninitialized): 0xC0000080 = R+W+UNINIT_DATA
- `.reloc`: 0x42000040 = R+DISCARDABLE+INIT_DATA
- `.tls`: 0xC0000040 = R+W+INIT_DATA

---

### Section Permissions & Security

| Permission | Value | Normal Sections | Suspicious If |
|------------|-------|-----------------|---------------|
| R-X | 0x60000000 | `.text` | — |
| R-- | 0x40000000 | `.rdata`, `.pdata`, `.rsrc`, `.reloc` | — |
| RW- | 0xC0000000 | `.data`, `.bss`, `.tls` | — |
| **RWX** | **0xE0000000** | **NONE** | **Shellcode, JIT, unpacking, DEP bypass** |
| R-X + W (self-modifying) | — | — | **JIT, unpacking stubs** |

**Red Flag**: Any section with `MEM_WRITE | MEM_EXECUTE` (0xA0000000). Defeats DEP/NX.

---

### Anomalies Worth Noticing

1. **Entry point in weird section** — `EntryPoint` RVA inside `.data`/`.rdata` = packed/injected
2. **Huge `SizeOfImage` vs tiny sections** — space for runtime decryption/unpacking
3. **Missing relocations with ASLR expected** — `DllCharacteristics & 0x40` but no `.reloc`
4. **TLS callbacks present** (DataDirectory[9] ≠ 0) — code runs before entry point
5. **Section count mismatch** — `NumberOfSections` ≠ actual sections
6. **Raw size > Virtual size** — usually impossible, indicates corruption/packer
7. **Overlapping sections** — RVAs overlap = packer trick
8. **Entry point in last section** — common for packers (stub at end)

---

## Interactive: PE Structure


Use the highlighted hex view to walk from `MZ` → `e_lfanew` → `PE` → Optional Header → Data Directories → Section Table.

---

## Takeaway

> The PE header is a map of everything the loader will do. Read it before anything else.

**Lab 11**: PE Header Forensics → [PE Header Forensics](/labs/lab-11)

---

## Practice Exercises

1. **Header Walk**: In the hex viewer, manually parse: MZ → e_lfanew → PE signature → File Header → Optional Header → DataDirectory[1] → Import Descriptors.
2. **Mitigation Audit**: Check `DllCharacteristics` and Load Config. Which of ASLR, DEP, CFG, CET, SafeSEH, XFG, RFG are enabled?
3. **RWX Hunt**: Scan `/binaries/` for sections with `MEM_WRITE | MEM_EXECUTE`. What do they contain?
4. **Packer Detection**: A binary has 3 sections: `.text` (entropy 7.9), `.rdata` (entropy 7.8), `.data` (entropy 7.9). Entry point in `.text` at offset 0x2000. Imports: only `LoadLibraryA`, `GetProcAddress`. What packer?
5. **TLS Callback**: DataDirectory[9] RVA=0x4000, Size=0x20. At 0x4000: array of RVAs [0x1000, 0x1050, 0]. What does this mean? Set BP on 0x1000.
6. **Relocation Math**: ImageBase=0x140000000, ActualBase=0x7FF712340000. DIR64 fixup at PageRVA=0x1000, Offset=0x50. Original value at VA=0x140001050 is 0x140005678. What's the patched value?