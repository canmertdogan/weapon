---
id: arm4
module: arm-mobile
title: "iOS & Mach-O Basics"
order: 4
objectives:
  - "Map the Mach-O structure: header, load commands, segments and sections"
  - "Compare Mach-O to PE and ELF as the same idea in a different format"
  - "Explain common iOS protections: code signing and jailbreak/debugger detection"
  - "Identify class-dump's role in recovering Objective-C and Swift class metadata"
duration: 20
---

## Same Problem, Third Format

Every OS loader needs to answer the same questions: where does this binary go in memory, what does it need to run, and where does execution start. Windows answers with PE (`/course/windows/w1`), Linux with ELF (`/course/linux/l1`), and Apple platforms — macOS and iOS alike — answer with **Mach-O**. Once you've read one binary format closely, the others are mostly vocabulary.

### The Layout

```
Mach Header       magic number, CPU type (arm64), file type, load command count
Load Commands     an ordered list of loader instructions
Segments          __TEXT, __DATA, __LINKEDIT, mapped from the segment load commands
Sections           subdivisions within a segment (__text, __const, __data, ...)
```

The header opens with a magic number (`0xFEEDFACF` for 64-bit) that identifies the file as Mach-O the same way `MZ` identifies PE and `\x7fELF` identifies ELF, and it directly states the target CPU architecture — relevant here because a **fat/universal binary** can bundle multiple Mach-O images (e.g. arm64 and x86_64 slices) inside one file for different hardware.

### Load Commands: PE's Data Directories, ELF's Program Headers

Where PE has a fixed 16-entry Data Directory array and ELF has program headers, Mach-O has **load commands** — a variable-length, ordered list where each command tells the loader to do one specific thing:

| Load command | Tells the loader to |
|---|---|
| `LC_SEGMENT_64` | map a segment into memory with given permissions |
| `LC_LOAD_DYLIB` | load a dependent shared library |
| `LC_MAIN` (or `LC_UNIXTHREAD`) | set the entry point |
| `LC_CODE_SIGNATURE` | locate the code signature blob |
| `LC_SYMTAB` | locate the symbol table |

Reading the load command list top to bottom is the Mach-O equivalent of walking PE's Data Directory array or ELF's `.dynamic` section — it's the fastest way to inventory what a binary depends on and how it's built, before looking at a single instruction.

### Segments and Sections

Two segments matter most for RE:

- **`__TEXT`** — read-execute, contains the `__text` section (actual machine code) plus read-only constants and Objective-C metadata sections.
- **`__DATA`** — read-write, contains globals, the Objective-C class list, and function pointers that are common targets for runtime patching since they're writable.

This maps directly onto the R-X `.text` / RW `.data` split you already know from PE and ELF — same security logic, same reason a writable-and-executable segment would be a red flag.

### Code Signing: Mandatory, Not Advisory

On Windows and Linux, code signing is optional — Authenticode and package signatures are checked by policy, not by the OS refusing to run unsigned code. iOS makes signature verification a **first-class, OS-enforced requirement**: the kernel will not execute a page of code that isn't covered by a valid signature (Apple's or a properly provisioned developer/enterprise certificate), and this is enforced continuously, not just at launch. This is why iOS reverse engineering and instrumentation tooling revolves so heavily around jailbreaking — bypassing that enforcement is a prerequisite for a lot of dynamic analysis that's trivial on desktop OSes.

### Jailbreak and Debugger Detection

Apps that care about tamper-resistance commonly check for:

- **Jailbreak indicators** — presence of `Cydia`/package-manager paths, unusual filesystem write access outside the sandbox, suspicious dylibs already loaded into the process.
- **Debugger presence** — calling `ptrace(PT_DENY_ATTACH, ...)` to prevent a debugger from attaching, or checking the `P_TRACED` flag via `sysctl`.
- **Code integrity** — hashing their own `__TEXT` segment at runtime and comparing against an expected value, to detect patching.

None of these are cryptographically strong on their own — they're speed bumps, and instrumentation frameworks exist specifically to hook and neutralize them — but recognizing the pattern in a disassembly (a `ptrace` call with no other purpose, a suspicious path string compared right before an abort) is a core iOS RE skill.

### class-dump: Recovering Metadata

Objective-C retains extensive runtime type metadata — class names, method signatures, property lists — inside the compiled binary, because the Objective-C runtime uses that metadata for dynamic dispatch. **class-dump** reads it directly out of the Mach-O and reconstructs header-file-like class declarations, giving you a near-complete map of an app's class hierarchy without decompiling a single function body.

Swift is a different story: Swift's metadata is less complete and its name mangling more complex, so class-dump's output on pure-Swift binaries is far patchier than on Objective-C ones — expect partial results, not a full reconstruction, on modern Swift-heavy apps.

## Takeaway

> Mach-O is the same header-plus-loader-instructions idea as PE and ELF wearing different names — the real iOS-specific work starts where mandatory code signing forces analysis to lean on jailbreaking and runtime metadata recovery instead of just static disassembly.
