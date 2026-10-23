---
name: task
description: Inspect, manage, or update tasks on the deterministic task board
agent: orchestrator
triage_level: STANDARD
workflow: direct
argument-hint: "[list|start <TASK-ID>|done <TASK-ID>|add <description>]"
---

Manage and inspect tasks on the deterministic task board (`docs/TASK_BOARD.md`, rules in `.agents/skills/task-board/SKILL.md`).

Requested action: $ARGUMENTS (default: `list`)

1. Read `docs/TASK_BOARD.md` and report the tasks under the `### [ IN_PROGRESS ]` and `### [ QUEUED ]` headings.
2. Before starting a task, verify all `DependsOn` prerequisite tasks are under `### [ DONE ]`.
3. To start a task, move its card under the `### [ IN_PROGRESS ]` heading and make sure it has an `Assignee:` line. The pre-tool-use Orchestration Gate only recognizes an active task in exactly this form:

   ```markdown
   ### [ IN_PROGRESS ]
   - **`TASK-002`**: Add password reset email
     - **Assignee:** Developer
     - **DependsOn:** TASK-001
     - **Triage Level:** STANDARD
   ```

4. Coordinate parallel gate verdicts (QA, Tester, Security) before moving a card to `### [ HUMAN_CHECKPOINT ]`, and to `### [ DONE ]` only after the human approves.
5. Record task updates and transition history cleanly.

Maintain alignment between `docs/TASK_BOARD.md` and `docs/CURRENT_STATE.md`.
