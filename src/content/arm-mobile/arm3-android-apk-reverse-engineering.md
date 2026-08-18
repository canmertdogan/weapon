---
id: arm3
module: arm-mobile
title: "Android APK Reverse Engineering"
order: 3
objectives:
  - "Describe an APK's structure: AndroidManifest.xml, classes.dex, lib/, resources.arsc"
  - "Explain the relationship between Java/Kotlin source, DEX bytecode, and Smali"
  - "Identify when native code (JNI / .so libraries) is used and why it's harder to reverse than DEX"
  - "Name the standard toolchain (apktool, jadx, Frida) and what each is for"
interactive: ""
lab: ""
duration: 25
---

## An APK Is Just a ZIP With Rules

An `.apk` file is a standard ZIP archive with a mandatory internal layout and a signature block. Unzip one and the analysis surface is immediately visible — no loader tricks required to see the pieces, only to understand what they mean.

### The Layout

```
AndroidManifest.xml   binary-XML manifest: permissions, components, entry points
classes.dex           compiled Java/Kotlin bytecode (may be classesN.dex, split)
resources.arsc        compiled resource table (strings, layouts, IDs)
res/                  raw resources referenced by resources.arsc
lib/<abi>/            native .so libraries, one directory per ABI (arm64-v8a, ...)
assets/               arbitrary files bundled unmodified, often used to hide payloads
META-INF/             signing certificate and manifest hashes
```

### The Manifest Is the Table of Contents

`AndroidManifest.xml` is stored in a compact binary XML format (not plain text — tools decode it), and it's the first thing worth reading in any APK. It declares:

- **Permissions** — what the app claims it needs (network, SMS, contacts, accessibility services). Overreaching permissions are an immediate red flag.
- **Components** — every `Activity`, `Service`, `BroadcastReceiver`, and `ContentProvider`, each a potential entry point that Android itself can invoke, not just code reachable from `main()`.
- **Entry points** — which activity launches on tap (`intent-filter` with `MAIN`/`LAUNCHER`), and which components are `exported` and therefore reachable from other apps.

### Source, Bytecode, and Smali

Android apps are written in Java or Kotlin, compiled to Java bytecode, then translated into **DEX** (Dalvik Executable) bytecode — a register-based instruction set designed for the Dalvik/ART virtual machine, distinct from both the stack-based JVM bytecode it started as and from native ARM64 machine code. All the app's classes across the codebase are merged into one (or more, if the app is large) `classes.dex` file rather than one file per class the way JVM `.class` files work.

**Smali** is the human-readable disassembly syntax for DEX bytecode — the DEX equivalent of reading raw x86 as assembly text instead of hex. You rarely write Smali from scratch, but patching an APK (flipping a boolean check, removing a call) is often done by editing Smali and reassembling, because it's far more tractable than editing DEX bytes directly.

### When Apps Drop to Native Code

Not everything in an APK is DEX. Performance-critical code — codecs, game engines, cryptographic routines — is frequently implemented in C/C++ and compiled to ARM64 `.so` libraries under `lib/arm64-v8a/`, called from Java/Kotlin through **JNI** (Java Native Interface). That's the legitimate reason.

The reverse-engineering-relevant reason: native code is a much bigger lift to analyze than DEX. `jadx` reliably reconstructs readable, near-source Java from DEX because the bytecode retains rich type and structure information. A stripped ARM64 `.so`, by contrast, decompiles the way any native binary does — the register-tracing skills from `arm1` and `arm2` apply directly, with no bytecode-level shortcuts. Apps and malware that specifically want to resist analysis will deliberately move sensitive logic (license checks, key material, anti-tamper checks) into native libraries for exactly this reason.

### The Toolchain

| Tool | Role |
|------|------|
| `apktool` | Unpacks an APK into editable resources and Smali, and repackages it back into an installable APK |
| `jadx` | Decompiles `classes.dex` into readable, near-source Java for static reading |
| `Frida` | Dynamic instrumentation — hooks Java or native functions at runtime to log arguments, change return values, or bypass checks without modifying the APK on disk |

A typical static pass: `apktool` to unpack and read the manifest and Smali, `jadx` for a higher-level read of the Java logic. When static analysis hits an obfuscated or native wall, `Frida` lets you observe the app's actual runtime behavior instead of reasoning about it statically.

## Takeaway

> DEX and Smali make Android's managed code some of the most approachable bytecode to reverse — which is exactly why anything an app wants to hide tends to move into native ARM64 .so libraries instead.
