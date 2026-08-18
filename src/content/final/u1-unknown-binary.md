---
id: u1
module: final
title: "The Unknown Binary"
order: 1
objectives:
  - "Apply the full methodology to an unknown sample"
  - "Chain strings, imports, and control flow into a verdict"
  - "Extract IOCs and document findings"
  - "Demonstrate the complete investigation loop"
interactive: ""
lab: "lab-capstone"
duration: 30
---

## The Final Exercise

You've learned the pieces. Now put them together. You're handed a binary with no name, no documentation, and one instruction:

> **Figure out what it is and what it does.**

### Your Toolkit (Everything So Far)

1. **Triage** — hash it, note size and type, run `strings`.
2. **Static analysis** — read imports (capabilities), follow strings to XREFs, read control flow.
3. **Assembly** — reconstruct logic from the code.
4. **Windows** — interpret the PE, the APIs, and their implications.
5. **Debugging** — reason about runtime behavior and anti-analysis.
6. **Reporting** — extract IOCs and write a verdict.

### The Investigation Loop

```
HYPOTHESIS → OBSERVE → REASON → INVESTIGATE → DOCUMENT
     ↑                                              ↓
     ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

Start with a hypothesis. Test it. Refine it. Document it.

### How to Approach the Challenge

Don't try to solve everything at once:

1. **What are the strings?** → domains, mutexes, paths. This alone often names the family.
2. **What are the imports?** → network, injection, persistence. This tells you *capability*.
3. **What's the narrative?** → "drops X, persists via Y, phones home to Z."
4. **What are the IOCs?** → every domain, mutex, path, and hash.

### Success Criteria

You haven't finished until you can write, in your own words:

- **What it is** — a family, type, or role.
- **What it does** — the behavior narrative.
- **How it persists** — mechanism and location.
- **How it communicates** — C2 endpoints.
- **What to block** — the IOCs.

---

## The Unknown Binary Awaits

Open the capstone lab and investigate. Use every technique you've learned. There is no single right path — only the discipline of the loop.

**Lab**: The Unknown Binary → [The Unknown Binary](/labs/lab-capstone)
