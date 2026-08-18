---
id: l1
module: linux
title: "ELF Format Deep Dive"
order: 1
objectives:
  - "Map the Elf64_Ehdr fixed-offset header layout"
  - "Distinguish program headers (runtime/loader view) from section headers (link-time view)"
  - "Read program header p_type/p_flags to identify PT_LOAD segments and permissions"
  - "Identify ET_EXEC vs ET_DYN and what that implies for ASLR"
interactive: "HexViewer"
lab: "lab-20"
duration: 25
---

## The ELF Header Is a Fixed Struct, Not a Chain of Pointers

Where PE makes you follow `MZ` → `e_lfanew` → `PE\0\0` before you reach anything useful (see [PE Format Deep Dive](/course/windows/w1)), `Elf64_Ehdr` is a single 64-byte struct sitting at offset 0 with every field at a constant, known position. No indirection, no stub. Read it fluently and you know exactly where the program headers, section headers, and entry point live.

### The Fixed 64-Byte Layout

| Offset | Field | Size | Meaning |
|--------|-------|------|---------|
| 0x00 | `e_ident` | 16 | `\x7fELF` magic + class/data/version/osabi |
| 0x10 | `e_type` | 2 | ET_EXEC, ET_DYN, ET_REL, ET_CORE |
| 0x12 | `e_machine` | 2 | ISA (e.g. `0x3e` = x86-64) |
| 0x14 | `e_version` | 4 | always 1 |
| 0x18 | `e_entry` | 8 | virtual address of the first instruction |
| 0x20 | `e_phoff` | 8 | file offset of the program header table |
| 0x28 | `e_shoff` | 8 | file offset of the section header table |
| 0x30 | `e_flags` | 4 | architecture-specific flags |
| 0x34 | `e_ehsize` | 2 | size of this header (64) |
| 0x36 | `e_phentsize` | 2 | size of one program header entry (56) |
| 0x38 | `e_phnum` | 2 | number of program headers |
| 0x3a | `e_shentsize` | 2 | size of one section header entry |
| 0x3c | `e_shnum` | 2 | number of section headers |
| 0x3e | `e_shstrndx` | 2 | index of the section name string table |

`e_ident` itself packs the essentials: bytes 0-3 are the magic `\x7fELF`, byte 4 is the class (`1`=32-bit, `2`=64-bit), byte 5 is the endianness, byte 6 the ELF version, byte 7 the ABI. Everything is little-endian on x86-64 — a field like `e_phoff = 0x40` is stored as `40 00 00 00 00 00 00 00`, not the other way around.

### Two Views of the Same File

```
Program Headers (e_phoff)     Section Headers (e_shoff)
runtime / loader's view       link-time / human's view
required to run the binary    optional — strippable
describe PT_LOAD segments     describe .text, .data, .bss, ...
```

This is the single most important ELF concept: **the kernel never reads section headers**. It maps the file using only the program header table. Strip the section headers entirely (`strip --strip-all`, or a hand-crafted malicious binary) and the file still runs perfectly — you've just deleted the friendly names and boundaries a disassembler uses. Section headers exist for the linker and for human convenience; program headers exist for `execve`.

### Program Headers: What the Loader Actually Maps

Each `Elf64_Phdr` is 56 bytes, starting at `e_phoff`:

| Field | Meaning |
|-------|---------|
| `p_type` | PT_LOAD, PT_INTERP, PT_DYNAMIC, PT_PHDR, PT_NOTE, ... |
| `p_flags` | permission bitmask: R=4, W=2, X=1 |
| `p_offset` | file offset of the segment's data |
| `p_vaddr` | virtual address to map it at |
| `p_filesz` / `p_memsz` | bytes in the file vs. bytes in memory (BSS grows `memsz` beyond `filesz`) |

Common `p_type` values:

- **PT_LOAD** — a chunk of the file to `mmap` into the process. A typical binary has at least two: one `r-x` (code) and one `rw-` (data/bss).
- **PT_INTERP** — the path to the dynamic linker (e.g. `/lib64/ld-linux-x86-64.so.2`), stored as a string at the segment's offset.
- **PT_DYNAMIC** — points to the `.dynamic` section: needed-library list, symbol/relocation tables.
- **PT_PHDR** — the location of the program header table itself, mapped so the dynamic linker can find it.

`p_flags` is refreshingly compact next to PE's sprawling `Characteristics` bitfield: `5` = `R-X` (code), `6` = `RW-` (data), `4` = `R--` (read-only data). A `PT_LOAD` segment with both `W` and `X` set is the same red flag as an `RWX` PE section — self-modifying or injected code.

### ET_EXEC vs. ET_DYN

`e_type` decides how the kernel places the binary in memory:

| Value | Type | Load address | ASLR |
|-------|------|---------------|------|
| `0x02` | ET_EXEC | fixed, hardcoded in `p_vaddr` | none for the main image |
| `0x03` | ET_DYN | chosen by the kernel at load time | full ASLR |

Old-style binaries are `ET_EXEC`: every `p_vaddr` is an absolute address, and the binary always lands at the same place — convenient for an attacker doing return-oriented programming. Modern toolchains default to building **PIE** (Position-Independent Executable) binaries, which are technically `ET_DYN` — structurally the same "shared object" shape as a `.so`, just with an entry point. The kernel maps a PIE at a randomized base, exactly like it does a shared library, giving the main executable ASLR too.

## Interactive: ELF Header Structure

Use the highlighted hex view to walk the fixed 64-byte header field by field, then follow `e_phoff` into the program header table and pick out the `PT_LOAD` segments and the `PT_INTERP` path string.

## Takeaway

> The ELF header is fixed-offset and self-describing; the program headers are the only truth the loader needs — everything else, sections included, is decoration for humans.

**Lab 20**: ELF Header Forensics → [ELF Header Forensics](/labs/lab-20)
