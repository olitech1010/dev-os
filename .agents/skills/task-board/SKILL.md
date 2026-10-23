---
name: task-board
description: "Use when creating, updating, or reading docs/TASK_BOARD.md, the task DAG the Orchestrator maintains. Defines task states, allowed transitions, dependencies, and ownership."
---

# Task Board & DAG Workflow Protocol

The Task Board (`docs/TASK_BOARD.md`) enforces stateful, deterministic execution of tasks across the agent roster.

## State Transitions & Invariants

```
BACKLOG ➔ QUEUED ➔ IN_PROGRESS ➔ PARALLEL_GATE ➔ HUMAN_CHECKPOINT ➔ DONE
                                      │
                                [BLOCKED / HALT] (Circuit Breaker)
```

### Invariant Rules
1. **Dependency Gate**: A task in `QUEUED` cannot move to `IN_PROGRESS` until all tasks in `DependsOn` have reached `DONE`.
2. **Parallel Gate Enforcement**: When implementation completes, the task transitions to `PARALLEL_GATE`. All three specialist gates must report verdicts:
   - **QA**: Code standards & cleanliness
   - **Tester**: Test coverage & regression suites
   - **Security**: Secret scans & vulnerability audit
3. **Circuit Breaker**: Follow "Circuit Breaker (canonical)" in `.agents/AGENTS.md`: after 3 failed fix iterations the Tech Lead gets exactly one arbitration attempt; if that fails, set the task to `BLOCKED` and the Orchestrator halts all subtasks and escalates to the human.
4. **Human Checkpoint**: No task can transition from `PARALLEL_GATE` to `DONE` without explicit human approval and commit token verification via `.agents/scripts/commit.sh`.
5. **Session-End Synchronization**: The active task state in `docs/TASK_BOARD.md` must match `docs/CURRENT_STATE.md`.
