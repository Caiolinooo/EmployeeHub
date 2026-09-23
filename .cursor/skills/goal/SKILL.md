---
name: goal
description: >-
  Keep a Cursor Goal armed for every non-trivial task. Use CreateGoal and
  UpdateGoal. Apply on multi-step work, implementations, debugging, refactors,
  or when the user states an objective. Always apply. Do not skip. Complements
  the official /goal skill; do not invent a second protocol.
---

# Goal (mandatory)

Canonical protocol is the official Cursor skill. Read it first. Follow it. Do not fork the rules.

Official file: `C:\Users\caio.correia\.cursor\skills-cursor\goal\SKILL.md`

## When to arm

Arm a Goal on any non-trivial task: more than one step, implementation, debug, refactor, or an explicit user objective.

Skip only for a one-shot lookup or a single factual answer with no follow-up work.

`/goal <objective>` still follows the official Parse/Start flow exactly.

## Start

1. Restate the full objective, including every explicit deliverable.
2. If `CreateGoal` exists this session, call it **exactly once**. Do not create goal files. Do not retry.
3. If `CreateGoal` is missing, keep the objective in one visible line and still pursue it to completion.
4. Do the first concrete unit of work in the same turn. Do not stop after planning.

## Keep it alive

- Keep the full objective intact. Do not shrink success to an easier subset.
- Do not abandon a goal silently.
- Call `UpdateGoal` only when the official skill allows it: status `complete` after a completion audit, or when the user pauses / you must stop incomplete (treat as pause).
- Do not mark complete because the turn ended.

## Completion

Before `UpdateGoal` complete: prove every requirement against current evidence (files, commands, tests, runtime). Weak or missing evidence = keep working.

If official skill and this wrapper conflict, official skill wins except this always-on trigger (non-trivial tasks, not only `/goal`).
