---
id: sa1
module: static-analysis
title: "Strings & Metadata"
order: 1
objectives:
  - "Extract actionable strings from a binary"
  - "Separate signal from noise in string output"
  - "Use strings as the first step of triage"
  - "Read PE metadata (timestamps, sections, entropy)"
  - "Handle obfuscated/encoded strings (stack strings, XOR, base64)"
  - "Correlate strings with imports and code references"
interactive: "HexViewer"
lab: "lab-04"
duration: 15
---

## Strings Are the First Signal

`strings` dumps printable ASCII/UTF sequences. It is the fastest way to learn what a binary *talks about*.

```sh
strings -a sample.exe      # scan the whole file, not just sections
strings -el sample.exe     # UTF-16LE strings (common in Windows)
strings -n 8 sample.exe    # minimum length 8 (filter noise)
```

### What to Look For

| Category | Examples | Meaning |
|----------|----------|---------|
| URLs / IPs | `http://c2.example.com/beacon` | C2 infrastructure |
| Registry paths | `Software\...\Run` | persistence |
| Mutexes | `Global\Mutex_0x7F3A` | single-instance guard |
| File paths | `%TEMP%\svchost.exe` | dropped payload |
| Error messages | `Invalid license key` | validation logic |
| Crypto constants | `MD5`, `SHA256` in symbol names | hashing |
| API names | `CreateRemoteThread` | capability hint |
| User-Agent | `Mozilla/5.0...` | HTTP client fingerprint |
| PDB paths | `C:\Build\malware.pdb` | build environment leak |

### Signal vs Noise

A compiler drags in hundreds of strings from the CRT and statically-linked libraries. Filter:

- **Rare and specific** strings matter (a URL, a mutex name).
- **Generic** strings (`%d`, `null`, `true`, `error`) are library noise.

The interesting strings are the ones a human wrote, not the compiler.

### UTF-16 vs ASCII

Windows APIs take UTF-16 (wide) strings. If a binary stores `KERNEL32.DLL` as UTF-16, plain `strings` misses it. Always check both encodings.

```sh
# ASCII/UTF-8
strings -a sample.exe

# UTF-16LE (Windows wide chars)
strings -el sample.exe

# UTF-16BE (rare)
strings -eb sample.exe
```

---

## Advanced String Extraction

### Stack Strings

Built character-by-character on stack — no `.rdata` reference:

```asm
mov [rsp+0x0], 'H'
mov [rsp+0x1], 'e'
mov [rsp+0x2], 'l'
mov [rsp+0x3], 'l'
mov [rsp+0x4], 'o'
mov [rsp+0x5], 0
lea rcx, [rsp]       ; pointer to "Hello"
```

**Detection**: Look for sequences of `mov byte [rsp+offset], imm8` with consecutive offsets.

### Encoded Strings (XOR/ADD/ROL)

```c
// Runtime decoding
char encoded[] = { 0x48^0xAA, 0x65^0xAA, ... };
for (i=0; i<len; i++) decoded[i] = encoded[i] ^ 0xAA;
```

**Detection**: 
- `strings` output shows high-entropy garbage
- Cross-references to decoding loop
- Ghidra: "Decompile" shows decode logic

### Base64 / Custom Encoding

```c
// Base64 encoded in binary
"SGVsbG8gV29ybGQ="  // "Hello World"
```

**Detection**: Strings with A-Z, a-z, 0-9, +, /, = padding.

### Resource-Embedded Strings

Stored in `.rsrc` section, loaded via:
```c
FindResource / LoadResource / LockResource
```

---

## Metadata

### Compile Timestamp

PE Header: `TimeDateStamp` (COFF File Header, offset 0x08 from PE signature)

- Unix timestamp (seconds since 1970-01-01)
- **Often forged**: 0, future dates, 0x2A425E19 (1992), etc.
- Can hint at build environment if genuine

### Section Names & Entropy

| Section | Normal | Suspicious |
|---------|--------|------------|
| `.text` | Code | Packed/encrypted |
| `.rdata` | Read-only data | — |
| `.data` | Read-write data | — |
| `.pdata` | Exception (x64) | — |
| `.rsrc` | Resources | Hidden payloads |
| `.reloc` | Relocations | Stripped (no ASLR) |
| `UPX0` / `UPX1` | — | UPX packed |
| `.packed` / `.enc` | — | Custom packer |
| `.vmp0` | — | VMProtect |

**Entropy**: Shannon entropy (0-8). 
- Normal code: 6.0-7.0
- Packed/encrypted: 7.5-8.0 (near random)
- `strings` on packed binary returns almost nothing — **itself a signal**

### Import/Export Names

- **Imports**: What the binary *needs* (capabilities)
- **Exports**: What the binary *provides* (DLL identity)

---

## Correlating Strings with Code

### Cross-References (Xrefs)

In Ghidra: Right string → `References` → "Show References to Address"

```
String "http://c2.com" at 0x403000
  Referenced by:
    0x401234  MOV RCX, 0x403000   ; arg to InternetConnect
    0x40123B  CALL InternetConnect
```

**Trace the data flow**: String → Register → API Argument → Capability confirmed.

### Annotated Strings

In Ghidra: Press `;` on string to add comment. Tag as `C2_URL`, `MUTEX`, `PERSISTENCE_KEY`, etc.

---

## Interactive: String Hunt


The hex dump below contains several planted strings. Find the C2 URL, the Run-key path, and the mutex name.

---

## Takeaway

> Strings are triage. Five minutes of string analysis directs five hours of deeper work.

**Lab 4**: Advanced String Hunt → [Advanced String Hunt](/labs/lab-04)

---

## Practice Exercises

1. **Dual Encoding**: Run `strings -a -el sample.exe`. Why do results differ?
2. **Stack String Hunt**: In Ghidra, search for `mov byte [rsp+`, `mov byte [rbp-`. Find a stack string.
3. **Entropy Scan**: Use `binwalk -E sample.exe` or `pefile` to compute section entropy. Flag sections > 7.5.
4. **Xref Trace**: Pick a suspicious string. Trace its xrefs to the calling API. What capability does it enable?
5. **Timestamp Forensics**: Convert `TimeDateStamp = 0x5F6E3C2A` to human time. Is it plausible?
6. **Obfuscation Detection**: A binary has 0 strings from `strings -a` but imports `VirtualAlloc`/`VirtualProtect`. What's likely?