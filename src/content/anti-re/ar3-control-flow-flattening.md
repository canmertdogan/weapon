---
id: ar3
module: anti-re
title: "Control Flow Flattening & Junk Code"
order: 3
objectives:
  - "Explain how control flow flattening replaces natural branching with a dispatcher and state variable"
  - "Identify opaque predicates and explain why they always resolve the same way despite looking conditional"
  - "Recognize junk or dead code inserted purely to waste analyst time"
  - "Propose a strategy (e.g. dynamic tracing) for cutting through flattened control flow"
interactive: "ControlFlowVisualizer"
duration: 20
---

## A Readable CFG Is a Map. Flattening Burns the Map.

A normal function's control flow graph looks like a tree or a small tangle of loops — you can glance at it and see the shape of the logic: this branch handles the error case, this loop processes the list. Control flow flattening destroys that shape on purpose, without changing what the function computes.

### Every Block Becomes a Sibling

The transformation (applied by a compiler pass or a dedicated obfuscator) takes a function's natural nested branches and loops and rewrites them into one flat loop wrapped around a single big dispatch:

```
Original shape:              Flattened shape:
  if (a) {                     state = ENTRY
    block1                     while (true) {
    if (b) block2                switch (state) {
    else   block3                  case ENTRY: ...; state = X; break
  } else {                        case X:     ...; state = Y; break
    block4                        case Y:     ...; state = Z; break
  }                               case Z:     return
                                }
                              }
```

Every original basic block becomes one `case` in a switch, keyed on a **state variable** that a dispatcher loop reads on every iteration to decide which block runs next. Structurally, block1 and block4 are no longer nested inside an `if` — they're both direct siblings hanging off the same dispatcher, indistinguishable in the graph from each other or from any other block in the function. A control flow graph that should look like a tree instead looks like a flat star or hub-and-spoke shape, with the dispatcher as the hub and every original block radiating out as a spoke that always leads back to the hub. This is exactly the shape the interactive visualizer below is built to render — a real flattened function looks like this at a scale of dozens of blocks, not the handful shown here.

### Opaque Predicates: Conditions That Aren't

Flattening is often paired with **opaque predicates** — conditions inserted into the code that are always true or always false by mathematical construction, but which a static analyzer can't cheaply prove one way or the other. Classic examples:

- `(x*x) >= 0` — always true for any signed integer `x` that doesn't overflow, but "always true" isn't obvious from local inspection.
- `7*y*y - 1 != x*x` — a number-theoretic identity (7y² − 1 is never a perfect square) that's always true, dressed up as an ordinary-looking comparison.

Because proving these identities requires real mathematical reasoning rather than pattern matching, a static analyzer that can't do that proof has to conservatively assume **both** branches of the "conditional" are reachable. The result is a CFG bloated with dead paths that never execute at runtime but still have to be considered, disassembled, and ruled out by hand.

### Junk Code: Pure Waste, By Design

Separately from flattening and predicates, obfuscators insert **junk or dead code** — instructions, or whole blocks, that compute values nothing ever reads. They don't affect program behavior at all; their only function is to lengthen the listing, break simple pattern-matching signatures, and cost the analyst time deciding "does this matter?" for logic that was never going to matter.

### Cutting Through It: Trace, Don't Read

Flattening and opaque predicates are attacks on *static* analysis specifically — they work by making the space of theoretically-reachable paths large and confusing while doing nothing to the actual runtime behavior. Dynamic tracing sidesteps the entire problem: run the code, log the sequence of blocks or instructions actually executed, and the recorded trace contains only the path that really happened. Dead branches from opaque predicates never appear because they're never taken. Junk code appears in the trace but is trivially recognizable as computing values that go nowhere. Stitching together traces across enough varied inputs typically recovers the real logical structure far faster than manually resolving every predicate in the static CFG by hand.

## Interactive: Control Flow Flattening

Compare the graph shown against what a real flattened dispatcher looks like blown up to production scale — dozens of sibling blocks hanging off one central switch, instead of the small structured branches you'd see in unobfuscated code.

## Takeaway

> Flattening doesn't hide the logic — it hides the shape. Run it once and the shape comes back.
