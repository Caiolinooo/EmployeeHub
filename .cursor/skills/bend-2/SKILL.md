---
name: bend 2
description: "Bend 2 language guidance: dependently typed, affine, massively parallel (CPU+GPU). LAWS.bend for formal proofs, correctness by construction. Use when working with .bend files, LAWS.bend, or proof-based development."
disable-model-invocation: true
icon: shield
color: purple
---

# Bend 2 Language Agent Skill

Bend is a dependently typed, affine language that checks in one linear bidirectional pass and runs massively parallel on CPU threads and GPUs.

## Key Files

    bend2/bend.ts       the language: parser, theory, checker (human-written, do NOT edit)
    bend2/comp.ts       the compiler and the runtimes (C, Metal, CUDA, JS)
    bend2/main.ts       the CLI; imported, the .bend loader for bun and node
    bend2/base.bend     the base library
    LAWS.bend           project rules the compiler enforces via mathematical proof
    PROOF.bend          proofs (written by AI) that LAWS hold

## Working with Bend

When using Bend:
- Run `bend guide` to learn the language.
- Use `LAWS.bend` to declare important rules/invariants the compiler enforces.
- Run `bend PROOF.bend` before committing to verify all laws hold.
- Parallelize code whenever possible (divide-and-conquer pattern).
- Bend syntax is Python-like with dependent types.
- Every test is a .bend file ending in `#|` lines its run must print.

## LAWS.bend Pattern

Laws declare formal invariants. Example:

```python
# LAWS.bend
law you_cant_win:
  for moves: List<Game.Move>
  board = Game.replay(Game.start(), moves)
  {Game.is_won(board) == False{} : Bool}
```

Laws only protect what is formally specified. Under-specified laws let agents satisfy the letter while violating the spirit. Write precise, complete laws.

## Proof Pattern

```python
# PROOF.bend
def Laws.you_cant_win(moves):
  # mathematical induction proof written by the AI
```

## Rules

- `bend2/bend.ts` is human-written: do NOT edit it.
- Tests live in `tests/<ns>/` with foreign `.c/.js` files.
- Gates: `gates/test.ts` (all tests), `gates/perf.ts` (benchmarks), `gates/repo.ts` (file allow list + ttok caps).
- Bend works best on Linux or macOS backends.
- Install: `curl -fsSL https://bend-lang.com/install.sh | sh`
