---
name: task-board
description: Rules and state transitions for managing the deterministic DAG task board in docs/TASK_BOARD.md across multi-agent workflows.
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
3. **Circuit Breaker**: If any agent loop exceeds 3 iterations without resolution, the task status MUST be set to `BLOCKED`, and the Orchestrator halts all subtasks to escalate to the human.
4. **Human Checkpoint**: No task can transition from `PARALLEL_GATE` to `DONE` without explicit human approval and commit token verification via `.agents/scripts/commit.sh`.
5. **Session-End Synchronization**: The active task state in `docs/TASK_BOARD.md` must match `docs/CURRENT_STATE.md`.
