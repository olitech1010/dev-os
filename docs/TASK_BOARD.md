# Dev-OS Task Board & DAG Workflow State

> Single source of truth for active task execution, dependencies, and gating status.
> Maintained by the **Orchestrator** agent.

---

## Workflow State Columns

```
[ BACKLOG ] ➔ [ QUEUED ] ➔ [ IN_PROGRESS ] ➔ [ PARALLEL_GATE ] ➔ [ HUMAN_CHECKPOINT ] ➔ [ DONE ]
                                                    │
                                           ┌────────┼────────┐
                                           ▼        ▼        ▼
                                          QA     TESTER   SECURITY
```

---

## Active Board

### [ IN_PROGRESS ]
- **`TASK-001`**: Dev-OS v3 Upgrades — Runtime Hooks, Memory, Packs, Task Board & Multi-Harness
  - **Assignee:** Developer / Orchestrator
  - **DependsOn:** None
  - **Triage Level:** STANDARD
  - **ParallelGate:** [QA: pending, Tester: pending, Security: pending]
  - **HumanCheckpoint:** pending

### [ QUEUED ]
*(No tasks currently queued)*

### [ BACKLOG ]
- **`TASK-002`**: Reliability & Eval Layer (`pass@k` test harness and agent scorecards)

### [ DONE ]
- **`TASK-000`**: Dev-OS v2.1.1 Official npm scope release under `@olives/devos`

---

## Task Card Schema
```markdown
### TASK-XXX: [Title]
- **Assignee:** [Orchestrator | Developer | QA | Tester | Security | DevOps | DBA]
- **DependsOn:** [List of prerequisite TASK IDs]
- **Triage Level:** [TRIVIAL | STANDARD | CRITICAL]
- **ParallelGate:** [QA: pass/fail/pending, Tester: pass/fail/pending, Security: pass/fail/pending]
- **HumanCheckpoint:** [pending | approved]
- **Artifacts:** [List of PRs, commits, or files modified]
```
