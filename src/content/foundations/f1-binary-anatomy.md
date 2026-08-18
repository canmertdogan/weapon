---
id: f1
module: foundations
title: "Binary Anatomy"
order: 1
objectives:
  - Identify PE/ELF magic bytes and validate file type
  - Map sections to memory permissions (R/W/X)
  - Locate entry point and understand its significance
  - Parse section headers manually in a hex editor
  - Explain the role of each PE header component
  - Compare PE vs ELF loading models
interactive: "HexViewer"
lab: "lab-01"
duration: 15
---

Every executable is a **structured container**. The OS loader reads this structure to map the binary into memory and begin execution.

## PE Format (Windows)

```
DOS Header (64 bytes)
  └─ "MZ" magic → Validates as executable
  └─ e_lfanew → Offset to NT Headers

NT Headers (Signature + File Header + Optional Header)
  ├─ Signature: "PE\0\0"
  ├─ File Header (COFF)
  │   ├─ Machine: 0x8664 (x64)
  │   ├─ NumberOfSections
  │   ├─ TimeDateStamp
  │   └─ Characteristics (DLL, EXE, etc.)
  └─ Optional Header (PE32+)
      ├─ Magic: 0x20B (PE32+)
      ├─ EntryPoint (RVA)
      ├─ ImageBase (preferred load address)
      ├─ SectionAlignment / FileAlignment
      └─ DataDirectories[16] → Imports, Exports, Relocs, TLS, etc.

Section Table (array of IMAGE_SECTION_HEADER)
  ├─ Name (8 bytes, e.g., ".text", ".rdata", ".data")
  ├─ VirtualSize / VirtualAddress (RVA)
  ├─ SizeOfRawData / PointerToRawData (file offset)
  └─ Characteristics (MEM_READ, MEM_WRITE, MEM_EXECUTE)
```

### DOS Header Deep Dive

| Offset | Field | Size | Purpose |
|--------|-------|------|---------|
| 0x00 | e_magic | 2 bytes | "MZ" signature (0x5A4D) |
| 0x02 | e_cblp | 2 bytes | Bytes on last page |
| 0x04 | e_cp | 2 bytes | Pages in file |
| 0x06 | e_crlc | 2 bytes | Relocations |
| 0x08 | e_cparhdr | 2 bytes | Header paragraphs |
| 0x0A | e_minalloc | 2 bytes | Min extra paragraphs |
| 0x0C | e_maxalloc | 2 bytes | Max extra paragraphs |
| 0x0E | e_ss | 2 bytes | Initial SS |
| 0x10 | e_sp | 2 bytes | Initial SP |
| 0x12 | e_csum | 2 bytes | Checksum |
| 0x14 | e_ip | 2 bytes | Initial IP |
| 0x16 | e_cs | 2 bytes | Initial CS |
| 0x18 | e_lfarlc | 2 bytes | Relocation table offset |
| 0x1A | e_ovno | 2 bytes | Overlay number |
| 0x1C | e_res | 8 bytes | Reserved |
| 0x24 | e_oemid | 2 bytes | OEM identifier |
| 0x26 | e_oeminfo | 2 bytes | OEM info |
| 0x28 | e_res2 | 20 bytes | Reserved |
| **0x3C** | **e_lfanew** | **4 bytes** | **Offset to NT Headers (critical!)** |

The DOS header exists for backward compatibility. The stub at offset 0x40 typically prints "This program cannot be run in DOS mode" — but the space between 0x40 and `e_lfanew` is a **classic hiding spot** for data.

### NT Headers: File Header (COFF)

| Offset | Field | Size | Values |
|--------|-------|------|--------|
| 0x00 | Machine | 2 bytes | 0x8664 (x64), 0x014c (x86), 0xAA64 (ARM64) |
| 0x02 | NumberOfSections | 2 bytes | Count of section headers following |
| 0x04 | TimeDateStamp | 4 bytes | Unix timestamp (linker time) — often forged |
| 0x08 | PointerToSymbolTable | 4 bytes | COFF debugging (usually 0) |
| 0x0C | NumberOfSymbols | 4 bytes | COFF debugging (usually 0) |
| 0x10 | SizeOfOptionalHeader | 2 bytes | 0xF0 (PE32), 0x108 (PE32+) |
| 0x12 | Characteristics | 2 bytes | Flags: 0x0001=relocs stripped, 0x0002=executable, 0x0004=line nums stripped, 0x0008=local syms stripped, 0x0020=large address aware, 0x2000=DLL |

### Optional Header (PE32+) — Key Fields

| Offset | Field | Size | Description |
|--------|-------|------|-------------|
| 0x00 | Magic | 2 bytes | 0x10B (PE32), 0x20B (PE32+), 0x107 (ROM) |
| 0x02 | Major/Minor Linker Version | 2 bytes | Linker version |
| 0x04 | SizeOfCode | 4 bytes | Sum of executable sections |
| 0x08 | SizeOfInitializedData | 4 bytes | Sum of initialized data sections |
| 0x0C | SizeOfUninitializedData | 4 bytes | Sum of uninitialized data (.bss) |
| **0x10** | **AddressOfEntryPoint** | **4 bytes** | **RVA of entry point (where execution starts)** |
| 0x14 | BaseOfCode | 4 bytes | RVA of .text |
| 0x18 | ImageBase | 8 bytes | Preferred load address (e.g., 0x140000000) |
| 0x20 | SectionAlignment | 4 bytes | Memory alignment (usually 0x1000) |
| 0x24 | FileAlignment | 4 bytes | Disk alignment (usually 0x200) |
| 0x28 | Major/Minor OS Version | 4 bytes | Required OS version |
| 0x2C | Major/Minor Image Version | 4 bytes | Binary version |
| 0x30 | Major/Minor Subsystem Version | 4 bytes | Subsystem version |
| 0x34 | Win32VersionValue | 4 bytes | Reserved (0) |
| 0x38 | SizeOfImage | 4 bytes | Total memory size (aligned) |
| 0x3C | SizeOfHeaders | 4 bytes | Headers + section table (aligned) |
| 0x40 | CheckSum | 4 bytes | PE checksum (rarely verified) |
| 0x44 | Subsystem | 2 bytes | 1=Native, 2=GUI, 3=CUI, 9=Windows CE |
| 0x46 | DllCharacteristics | 2 bytes | 0x0040=ASLR, 0x0100=DEP, 0x0200=No SEH, 0x0400=No Bind, 0x0800=WDM, 0x2000=Terminal Server Aware, 0x4000=CE, 0x8000=Guard CF |
| 0x48 | SizeOfStackReserve | 8 bytes | Initial stack reservation |
| 0x50 | SizeOfStackCommit | 8 bytes | Initial stack commit |
| 0x58 | SizeOfHeapReserve | 8 bytes | Heap reservation |
| 0x60 | SizeOfHeapCommit | 8 bytes | Heap commit |
| 0x68 | LoaderFlags | 4 bytes | Reserved (0) |
| 0x6C | NumberOfRvaAndSizes | 4 bytes | Always 16 |
| **0x70** | **DataDirectory[16]** | **128 bytes** | **Critical: Imports, Exports, TLS, Relocs, etc.** |

### Data Directories (Index → Purpose)

| Index | Name | Purpose |
|-------|------|---------|
| 0 | Export | Functions this binary provides |
| **1** | **Import** | **Functions this binary needs (IAT)** |
| 2 | Resource | Icons, manifests, version info |
| 3 | Exception | .pdata (unwind info for x64) |
| 4 | Security | Authenticode signature |
| **5** | **Base Relocation** | **ASLR fixups** |
| 6 | Debug | PDB path, timestamp |
| 7 | Architecture | Reserved |
| 8 | Global Ptr | RISC |
| **9** | **TLS** | **Thread Local Storage callbacks** |
| 10 | Load Config | CFG, CET, Guard CF, RFG |
| 11 | Bound Import | Pre-bound IAT timestamps |
| **12** | **IAT** | **Runtime-resolved import addresses** |
| 13 | Delay Import | Load on first call |
| 14 | COM Descriptor | .NET metadata |
| 15 | Reserved | — |

### Section Headers (IMAGE_SECTION_HEADER) — 40 bytes each

| Offset | Field | Size | Description |
|--------|-------|------|-------------|
| 0x00 | Name | 8 bytes | Null-padded (e.g., ".text\0\0\0") |
| 0x08 | VirtualSize | 4 bytes | Size in memory |
| 0x0C | VirtualAddress | 4 bytes | RVA in memory |
| 0x10 | SizeOfRawData | 4 bytes | Size on disk (file-aligned) |
| 0x14 | PointerToRawData | 4 bytes | File offset (file-aligned) |
| 0x18 | PointerToRelocations | 4 bytes | COFF relocations (obj files) |
| 0x1C | PointerToLinenumbers | 4 bytes | COFF line numbers |
| 0x20 | NumberOfRelocations | 2 bytes | COFF |
| 0x22 | NumberOfLinenumbers | 2 bytes | COFF |
| **0x24** | **Characteristics** | **4 bytes** | **Permissions + flags** |

**Section Characteristics (flags)**:
- 0x00000020 = CODE
- 0x00000040 = INITIALIZED_DATA
- 0x00000080 = UNINITIALIZED_DATA
- **0x20000000 = MEM_EXECUTE** (X)
- **0x40000000 = MEM_READ** (R)
- **0x80000000 = MEM_WRITE** (W)
- Common combos: `.text` = 0x60000020 (R+X+CODE), `.rdata` = 0x40000040 (R+INIT_DATA), `.data` = 0xC0000040 (R+W+INIT_DATA)

---

## Key Sections

| Section | Typical Content | Permissions | Characteristics |
|---------|-----------------|-------------|-----------------|
| `.text` | Code (instructions) | R-X | 0x60000020 |
| `.rdata` | Read-only data, imports, relocations | R-- | 0x40000040 |
| `.data` | Initialized global/static variables | RW- | 0xC0000040 |
| `.pdata` | Exception handling (x64) | R-- | 0x40000040 |
| `.rsrc` | Resources (icons, manifests) | R-- | 0x40000040 |
| `.reloc` | Base relocation table | R-- | 0x42000040 |
| `.tls` | Thread Local Storage data | RW- | 0xC0000040 |
| `.bss` | Uninitialized data | RW- | 0xC0000080 |

---

## Hands-On: Parse a PE Header


**Exercise**: In the hex viewer above:
1. Find the `MZ` signature at offset `0x0`
2. Read `e_lfanew` at `0x3C` (little-endian) → jump to NT Headers
3. Verify `PE\0\0` signature
4. Count sections in File Header
5. Locate Entry Point RVA in Optional Header
6. Match section table entries to the hex dump

---

## Why This Matters

- **Packers** modify headers to hide sections / change entry point
- **Malware** abuses `Characteristics` (e.g., RWX sections)
- **Entry Point** is where execution *actually* starts — not `main`
- **Data Directories** reveal capabilities (imports = what it calls, exports = what it provides)
- **TimeDateStamp** often forged — check for 0 or future dates
- **ImageBase** collisions trigger relocations (ASLR)

---

## ELF (Linux) — Quick Comparison

```
ELF Header (64 bytes)
  ├─ e_ident: 0x7F "ELF" + class (32/64) + endianness
  ├─ e_type: ET_EXEC / ET_DYN
  ├─ e_entry: Entry point (virtual address)
  ├─ e_phoff / e_shoff: Program/Section header table offsets
Program Headers → Segments (loader view, RWX perms)
Section Headers → Sections (linker view, semantic names)
```

**Key Differences**:

| Aspect | PE (Windows) | ELF (Linux) |
|--------|--------------|-------------|
| Loading Unit | Section | Segment (Program Header) |
| Sections | Mandatory, semantic names | Optional (strip removes) |
| Permissions | Per-section | Per-segment (PT_LOAD) |
| Entry Point | RVA (Relative Virtual Address) | Virtual Address (absolute) |
| Relocations | Base Reloc Directory | .rela.dyn / .rela.plt |
| Dynamic Linking | Import Directory (IAT) | .dynamic + .got.plt + .plt |
| TLS | TLS Directory (DataDir[9]) | PT_TLS segment |

**Same concepts, different layout.** PE = Section-centric. ELF = Segment-centric for loading.

---

## Takeaway

> The header is a map. Read it before you enter the territory.

**Lab 1**: Parse headers manually → [Hidden String Hunt](/labs/lab-01)

---

## Practice Exercises

1. **Header Forensics**: Given a PE with `TimeDateStamp = 0x5A5A5A5A`, `NumberOfSections = 0`, `Characteristics = 0x010F` — what's suspicious?
2. **Section Mismatch**: A section has `VirtualSize=0x1000` but `SizeOfRawData=0`. What does this indicate? (Answer: `.bss` — uninitialized data)
3. **RWX Hunt**: Scan a directory of binaries for sections with `MEM_WRITE | MEM_EXECUTE`. Why is this dangerous?
4. **Entry Point Trace**: In Ghidra, navigate to the Entry Point RVA. Is it the CRT startup code (`__security_init_cookie`, `__tmainCRTStartup`) or custom?