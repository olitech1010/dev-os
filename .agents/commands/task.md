---
name: task
description: Inspect, manage, or update tasks on the deterministic task board
agent: orchestrator
triage_level: STANDARD
workflow: standard
---

Manage and inspect tasks on the deterministic task board.

1. Read `docs/TASK_BOARD.md` and report active tasks in `[IN_PROGRESS]` and `[QUEUED]`.
2. Verify all `DependsOn` prerequisite tasks are `DONE` before starting new tasks.
3. Coordinate parallel gate verdicts (QA, Tester, Security) before advancing to Human Checkpoint.
4. Record task updates and transition history cleanly.

Maintain alignment between `docs/TASK_BOARD.md` and `docs/CURRENT_STATE.md`.
