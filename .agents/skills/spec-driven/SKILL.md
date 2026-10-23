---
name: spec-driven
description: "Use when a feature is big enough to need written requirements, a design, and a traceable task list before code (the /spec command or the spec-driven workflow). Produces docs/specs/<slug>/requirements.md with EARS acceptance criteria, design.md, and a machine-checkable tasks.md, with a human checkpoint after each phase."
---

# Spec-Driven Delivery

A spec is three files in `docs/specs/<slug>/`, written in order, each approved by the human before the next one starts:

| Phase | File | Answers | Checkpoint |
|---|---|---|---|
| 1. Requirements | `requirements.md` | What must be true, testably | Human approves the R ids |
| 2. Design | `design.md` | How the system will satisfy each R id | Human approves the approach |
| 3. Tasks | `tasks.md` | Which small, ordered, verifiable steps build it | Human approves; this is the Rule 22 plan |

The value is traceability. Every acceptance criterion has an id, every design section names the ids it serves, and every task names the ids it covers and the command that proves it is done. `devos spec check` and `devos spec waves` read the files mechanically, so the format rules below are strict.

## When to Use

- A STANDARD or CRITICAL feature with more than a couple of tasks, several components, or behaviour that a reviewer will want to test against.
- The human asks for a spec, or runs `/spec <feature>`.
- Work where several agents will run in parallel and need a shared dependency order.

## When Not to Use

- TRIVIAL Fast Path changes (see `.agents/AGENTS.md`). No spec, no plan.
- A whole new product from a vague idea: run Project Inception (`grill-me`) first, then spec the first feature.
- Open-ended exploration where the shape of the solution is unknown: use `brainstorming`, then come back here or go to `writing-plans`.

`writing-plans` and this skill both satisfy Hard Rule 22. Pick one per change. Use a spec when traceability to requirements and parallel waves matter; use a plan in `docs/plans/` for a smaller, linear change.

## Setup

1. Choose a short kebab-case slug for the feature (`password-reset`, `csv-export`).
2. Check that `docs/specs/<slug>/` does not exist. If it does, you are revising an existing spec: read all three files and work from the earliest phase that needs to change.
3. Read the inputs: `docs/PROJECT_REQUIREMENTS.md`, `CODING_STANDARDS.md`, `DESIGN.md` if the feature has UI, and `docs/LESSONS.md` entries for the same area.
4. Create the directory and copy the templates from [references/](references/):
   [requirements](references/requirements-template.md), [design](references/design-template.md), [tasks](references/tasks-template.md).
   The same templates ship in `docs/specs/_template/` of an installed project; copy that folder to `docs/specs/<slug>/`.

## Phase 1: Requirements

Write `requirements.md`. The Architect owns it; the PM writes the user stories when one is involved.

For each requirement:

- A heading `### Rn: <title>`. Ids start at `R1` and never get renumbered after approval; retired ids stay retired.
- One user story: "As a <role>, I want <capability>, so that <benefit>."
- Numbered acceptance criteria in EARS form. Each criterion must be something a test can pass or fail.

### EARS patterns

EARS (Easy Approach to Requirements Syntax) keeps criteria short and testable by fixing the sentence shape. Use the keyword in capitals.

| Pattern | Shape | Use for |
|---|---|---|
| Event | WHEN <trigger> THE SYSTEM SHALL <response> | Something happens |
| Unwanted | IF <bad condition> THEN THE SYSTEM SHALL <response> | Errors, abuse, bad input |
| State | WHILE <state> THE SYSTEM SHALL <behaviour> | Behaviour that holds during a mode |
| Optional | WHERE <feature or config is present> THE SYSTEM SHALL <behaviour> | Flags, plans, tiers |
| Always | THE SYSTEM SHALL <behaviour> | Invariants |

Patterns can combine: "WHILE the account is locked, WHEN a reset link is used, THE SYSTEM SHALL reject it with a 423 status."

Good criterion: "WHEN a user submits the reset form with a registered email THE SYSTEM SHALL send one reset email within 60 seconds."
Weak criterion: "The reset flow should be fast and secure." There is no trigger, no observable result, and no number.

Also write the glossary, out-of-scope list, and open questions. Every open question is either answered by the human or turned into an explicit assumption before the checkpoint.

**Checkpoint 1.** Present the R ids with a one-line summary each, the out-of-scope list, and any assumptions. Stop and wait. On approval, set `Status: APPROVED (checkpoint 1, <date>, <approver>)` at the top of the file. Do not start the design before this.

## Phase 2: Design

Write `design.md` against the approved requirements only.

- Start with the requirement trace table: every R id maps to the section that handles it. An R id with no home is a gap; fix it before going on.
- Name concrete components, interfaces, and data. Real file paths, function signatures, routes, table names.
- Verify every library API you rely on through the Researcher or the official docs (Hard Rule 11). Record the version.
- Route the parts other agents own: schema and migrations to the DBA (`db-check.sh` rules apply), auth and input handling to Security, UI to the UI Designer (the Design Gate needs an approved `DESIGN.md`), new dependencies to the Researcher (Hard Rule 12).
- List at least one alternative you rejected and why. A design with no alternatives was not designed.
- Cover error handling and the testing strategy. Each error row cites the R id it protects.

**Checkpoint 2.** Present the overview, the trace table, the rejected alternatives, and the review notes from DBA, Security, or UI Designer. Stop and wait. On approval, update the status line.

If the design shows that a requirement is wrong or missing, stop and return to checkpoint 1 with the proposed change. Do not quietly edit approved requirements.

## Phase 3: Tasks

Write `tasks.md`. Each task is one reviewable, commit-sized change.

### The parseable format

This grammar is what `devos spec check` and `devos spec waves` parse. It is also documented at the top of the template.

```
### T<n>: <title>
- depends: none | T<a>, T<b>, ...
- covers: R<x>, R<y>, ...
- verify: <command or check>
```

- Heading: exactly `###`, one space, the id, a colon, one space, a non-empty title. Ids are `T` plus a positive integer with no leading zero, unique in the file.
- A task block runs to the next `##` or `###` heading or the end of the file.
- Each block has exactly one `depends:`, one `covers:`, and one `verify:` line, written as a dash, one space, the lowercase key, a colon, one space, and the value. Order is free. Other lines in the block are free text and ignored.
- `depends:` is `none` or a comma-separated list of task ids defined in the same file. No self-dependency, no cycles.
- `covers:` lists one or more R ids that exist as `### Rn:` headings in `requirements.md`.
- `verify:` is a non-empty command or check.
- Lines inside fenced code blocks are ignored in both files.

Requirement headings in `requirements.md` use the same shape: `### R<n>: <title>`.

### Writing good tasks

- Order by dependency: data layer, then services, then callers and UI. Declare only real dependencies; a false one serializes work that could run in parallel.
- Test first: a task that changes behaviour names the failing test it starts with, in the free-text lines.
- `verify:` is a real command with an expected result where possible (`npm test -- reset.test.ts`), or a precise manual check when no automation exists ("open /reset, submit a registered email, see the confirmation banner").
- Flag gates in the free text: DBA review, Security review, Design Gate, new environment variables (`env-check.sh`), new dependencies.
- No placeholders such as "TBD" or "handle errors". Open decisions go back to the human.

### Mechanical checks

Run both before the checkpoint and fix every finding:

```bash
devos spec check <slug>    # every R covered, every covers: id exists, every task has verify:
devos spec waves <slug>    # parallel waves; fails on cycles and unknown ids
```

**Checkpoint 3.** Present the waves output, the task count per wave, and which tasks carry DBA, Security, or Design gates. Stop and wait. On approval, update the status line. The approved `tasks.md` is the implementation plan for Hard Rule 22.

## After Approval

1. The Orchestrator records the tasks on `docs/TASK_BOARD.md`, one card per task with an `Assignee:`, released wave by wave.
2. Each task runs through Standard Feature Delivery: Developer, then the parallel QA / Tester / Security gate, then the human review and commit via `.agents/scripts/commit.sh`. The Circuit Breaker applies per task.
3. A task is done when its `verify:` passes and the gates approve. Note the result in the task's free-text lines if useful; do not change the field lines.
4. When implementation reveals a gap, stop. Small fixes inside one task's scope are fine. A new or changed requirement goes back through checkpoint 1, and design and tasks are updated to match before work continues.

## Rules

- Everything lives under `docs/specs/<slug>/` (Hard Rule 7). Do not commit the spec yourself; it goes through Staged Review like any other change.
- All prose passes `.agents/scripts/humanize-check.sh`.
- Never skip a checkpoint, even in `/auto` mode. In autonomous runs the checkpoints are the human gates.
- No production code is written during any of the three phases.
