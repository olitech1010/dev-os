---
name: writing-plans
description: "Use when you have an approved spec or requirements for a multi-step change, before writing production code. Produces a bite-sized, test-first implementation plan in docs/plans/ that satisfies the Implementation Plan Gate."
metadata:
  source: https://github.com/obra/superpowers
license: MIT
---

# Writing Implementation Plans

An implementation plan turns an approved spec into a sequence of small, verifiable steps that another agent (or a future session with no memory of this one) can execute without guessing. It is the artifact the Implementation Plan Gate (Hard Rule 22 in `.agents/AGENTS.md`) checks for before the Developer writes production code.

## When to Use

- A spec from the `brainstorming` skill has been approved (`docs/specs/YYYY-MM-DD-<topic>-design.md`).
- `docs/PROJECT_REQUIREMENTS.md` or a set of user stories has been approved and the next step is code.
- A STANDARD or CRITICAL task touches more than one file or needs more than one commit-sized change.

## Spec Task Lists Count as Plans

An approved `docs/specs/<slug>/tasks.md` from the `spec-driven` skill (`.agents/skills/spec-driven/SKILL.md`, the `/spec` command) also satisfies Rule 22. Do not write a second plan for a feature that already has an approved spec; execute its tasks wave by wave. Use this skill instead of a spec for smaller, linear changes where requirement traceability and parallel waves add little.

## When Not to Use (TRIVIAL Exemption)

Skip the plan for work that qualifies for the **TRIVIAL Fast Path** in `.agents/AGENTS.md`: a diff under roughly 30 changed lines with no new dependency, schema, auth, or public API change (typo fixes, copy edits, one-line bug fixes, config value tweaks). If the change grows past those limits mid-task, stop and write a plan before continuing.

## Inputs to Gather First

1. The approved spec or requirements file. If none exists and the task is not TRIVIAL, stop and ask the Orchestrator to run `brainstorming` first.
2. `CODING_STANDARDS.md` and the relevant stack guide in `.agents/skills/stacks/`.
3. The current code: read every file the plan will touch. Do not plan against imagined file layouts.
4. `docs/LESSONS.md` entries for the same area.
5. Verified API facts for any library the plan relies on (Researcher, or official docs). Do not plan around unverified signatures.

## Output Location

Write the plan to:

```
docs/plans/YYYY-MM-DD-<slug>.md
```

`<slug>` is a short kebab-case name for the change (for example `2026-10-22-password-reset-email.md`). Create `docs/plans/` if it does not exist. Do not commit the plan; it goes through the human's Staged Review like any other change.

## Plan Structure

```markdown
# <Change name> — Implementation Plan

Spec: docs/specs/<file>.md            (or the requirements file this plan implements)
Triage: STANDARD | CRITICAL
Branch: feat/<slug>

## Goal
One or two sentences: what will be true when this plan is done.

## Out of Scope
What this plan deliberately does not change.

## Files
- Create: path/to/new-file.ts — purpose
- Modify: path/to/existing.ts — what changes
- Test:   path/to/existing.test.ts — what it covers

## Steps
### Step 1: <name>
- Test first: <test file and the failing case to add>
- Change: <file(s) and the specific edit>
- Verify: <exact command, expected result>

### Step 2: ...

## Verification
- Full checks: <lint, typecheck, test, build commands>
- Manual: <what the human should click or run to see it working>

## Risks and Rollback
- <risk> — <mitigation or how to revert>
```

## Rules for Good Steps

- **Bite-sized.** Each step is one focused change a reviewer can read in a few minutes, typically 2 to 15 minutes of work. If a step needs "and then" more than once, split it.
- **Test first.** Every step that adds or changes behaviour names the failing test to write before the code, then the change that makes it pass. Pure refactors name the existing tests that must stay green.
- **Concrete paths.** Use real repository paths, function names, and commands. "Update the auth module" is not a step; "In `src/auth/session.ts`, make `revokeSession()` delete the refresh token row" is.
- **Runnable verification.** Each step ends with a command and the expected outcome (for example `npm test -- session.test.ts` passes with the new case). No "verify it works".
- **Ordered by dependency.** Data layer before API, API before UI. Mark steps that can run in parallel.
- **Gates called out.** Flag steps that trigger a gate: schema or migration (DBA, `db-check.sh`), auth or input handling (Security), frontend files (Design Gate, `ui-taste-check.sh`), new environment variables (`env-check.sh`), new dependencies (Researcher, Hard Rule 12).
- **No placeholders.** No "TBD" or "handle errors appropriately". If a decision is open, list it under a "Questions for the human" heading and stop before that step.

## Self-Review Before Handing Off

1. Every requirement in the spec maps to at least one step.
2. Every step has a test and a verification command.
3. File paths exist (or are explicitly marked Create).
4. Nothing in the plan contradicts `CODING_STANDARDS.md` or the Hard Rules.

## Hand-Off

Present the plan path and a short summary to the human (or the Orchestrator) and wait for approval. Once approved, the Orchestrator records the task on `docs/TASK_BOARD.md` with an `Assignee:` and the Developer executes the steps in order, stopping at any failed verification instead of improvising.
