# WEAPON

> **reverse_engineering.init()**

**Live course: [canmertdogan.github.io/weapon](https://canmertdogan.github.io/weapon)** — open it and start learning right now, no setup required.

A reverse engineering startup course. Binary analysis, assembly, debugging, and OS internals — taught through interactive investigation.

WEAPON is a **fully static website** built with [Astro](https://astro.build) and deployed on GitHub Pages. There is no backend, database, or authentication. Every interactive component and lab runs entirely in the browser.

[![Static](https://img.shields.io/badge/site-static-ff2b3a)](https://astro.build)
[![Built with Astro](https://img.shields.io/badge/built%20with-Astro-ff5a3c)](https://astro.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

## What is it?

WEAPON is a hands-on field manual for learning reverse engineering from the ground up. You don't just read about a `CALL` instruction — you learn how to determine *what function it invokes, what arguments it receives, and why it matters*.

Every lesson follows the same loop:

1. **Investigation** — concept first, then the question that matters
2. **Methodology** — hypothesize, test, document
3. **Hands-on** — interactive visualizers, a safe instruction playground, and browser-based labs

No infrastructure required. Everything runs in your browser.

---

## The Course

12 modules, 53 lessons, and 24 labs, progressing from fundamentals to a full capstone investigation.

| # | Module | Focus |
|---|--------|-------|
| — | **Start** | Orientation: what RE is, how to think like a reverse engineer |
| 01 | **Foundations** | Binary anatomy, CPU fundamentals, memory layout, executable formats |
| 02 | **Assembly** | Registers, instructions, stack, functions, control flow, bit tricks, SIMD |
| 03 | **Static Analysis** | Strings, imports, functions, cross references, decompilation |
| 04 | **Debugging** | Breakpoints, register inspection, execution flow, anti-debugging |
| 05 | **Exploit Development** | Stack overflows, shellcode, memory protections, ROP |
| 06 | **Windows** | PE format, processes, threads, DLLs, the Windows API |
| 07 | **Linux** | ELF format, processes & syscalls, dynamic linker, Linux tooling |
| 08 | **ARM64 & Mobile** | ARM64 architecture, calling conventions, Android & iOS reversing |
| 09 | **Malware Analysis** | Behavior, persistence, C2, obfuscation, IOC extraction |
| 10 | **Anti-RE & Obfuscation** | Unpacking, VM-based obfuscation, control flow flattening, anti-disassembly |
| — | **Final** | The Unknown Binary — a capstone investigation that ties everything together |

---

## Features

- **Course** — structured modules that unlock sequentially as you complete lessons.
- **Labs** — 24 browser-based challenges with progressive hints (cooldown-timed), answer validation, methodology walkthroughs, common pitfalls, and extension challenges.
- **Interactive components** — Hex Viewer, Assembly Visualizer, Stack Visualizer, Instruction Playground, Control Flow Visualizer, and Debugger Simulator.
- **Progression** — a rank system (`RECRUIT → ANALYST → RESEARCHER → REVERSE ENGINEER → BINARY HUNTER`) and completion tracking stored in `localStorage`.
- **Lesson notes** — auto-saving per-lesson notes with export/import.
- **Offline support** — service worker for offline access.
- **Print-friendly** — every lesson can be printed or saved as PDF.
- **Command palette** — fuzzy search across lessons.
- **Custom themes** — default, terminal, amber, and monochrome.

---

## Getting Started

```sh
npm install
npm run dev
```

Open `http://localhost:4321` (or the URL printed by the dev server).

### Requirements

- Node.js `>= 22.12.0`

---

## Build & Preview

```sh
npm run build
npm run preview
```

The production site is generated to `./dist/`. Because the output is fully static, the Node.js toolchain is only needed at build time — the deployed site is just HTML, CSS, and JavaScript.

---

## Deployment (GitHub Pages)

A workflow is included at `.github/workflows/deploy.yml`. It builds and deploys on every push to `main`.

1. Create a repository named **`weapon`** on GitHub.
2. Push this repository to it:
   ```sh
   git remote add origin https://github.com/<username>/weapon.git
   git push -u origin main
   ```
3. In the repository settings, enable **Settings → Pages → Source → GitHub Actions**.
4. The site publishes to `https://<username>.github.io/weapon/`.

> The site's `base` path is configured in `astro.config.mjs` and defaults to `/weapon/`, matching a repository named `weapon`. If your repository has a different name, change `base` to `/<your-repo>/`.

---

## Project Structure

```text
/
├── public/                  # Static assets (favicon, lab binaries, 404, service worker)
├── src/
│   ├── components/          # Layout + interactive components (vanilla TS + Astro islands)
│   │   └── interactive/     #   Visualizers, playground, islands
│   ├── content/             # Lessons (Markdown) and lab manifests (JSON)
│   │   ├── <module>/        #   Lesson markdown per module
│   │   └── labs/<lab-id>/   #   Lab manifests
│   ├── data/                # Module metadata and sample data
│   ├── integrations/        # Build-time validation (lesson frontmatter)
│   ├── layouts/             # Base, Lesson layouts
│   ├── pages/               # Routes (landing, course, labs, about)
│   ├── plugins/             # Remark/Rehype plugins (base links, Shiki highlighting)
│   ├── scripts/             # Client-side progress & UI logic
│   ├── styles/              # Design tokens and global styles
│   ├── types/               # Shared TypeScript types
│   └── utils/               # Course registry, asm engine, hex/PE helpers
├── astro.config.mjs
└── package.json
```

---

## Content Authoring

### Lessons

Lessons live in `src/content/<module>/` as Markdown with YAML frontmatter:

```yaml
---
id: f1
module: foundations
title: "Binary Anatomy"
order: 1
objectives:
  - "Identify PE/ELF magic bytes and validate file type"
  - "Map sections to memory permissions (R/W/X)"
interactive: "HexViewer"   # optional interactive component
lab: "lab-01"             # optional paired lab
duration: 15
---
```

### Labs

Labs live in `src/content/labs/<lab-id>/manifest.json`:

```json
{
  "id": "lab-01",
  "title": "Hidden String Hunt",
  "module": "foundations",
  "lesson": "f1",
  "difficulty": "Easy",
  "estimatedTime": 10,
  "prerequisites": ["f1-binary-anatomy"],
  "binary": { "format": "PE", "name": "mystery.exe", "file": "/binaries/lab-01.hex" },
  "questions": [
    { "id": "q1", "type": "string", "prompt": "What is the hidden string?", "answer": "weapon{first_flag}" }
  ],
  "hints": ["Strings are not always in a dedicated section."],
  "methodology": "## Investigation Methodology\n\n...",
  "commonPitfalls": ["Running `strings` with default settings"],
  "tools": ["Hex editor", "Built-in Hex Viewer"],
  "references": ["Lesson F1: Binary Anatomy"],
  "extensions": ["Modify the binary to hide a second string"],
  "solution": "## Hidden String Hunt — Solution\n\n..."
}
```

Lesson frontmatter is validated at build time (`src/integrations/validate-lessons.ts`).

---

## License

This project is intended for educational purposes only. All content is designed to teach defensive and analytical reverse engineering skills.

---

> **The header is a map. Read it before you enter the territory.**
