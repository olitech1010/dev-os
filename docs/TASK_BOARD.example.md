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
*(none)*

### [ QUEUED ]
*(none)*

### [ BACKLOG ]
- **`TASK-001`**: Initial setup task
  - **Assignee:** Orchestrator
  - **DependsOn:** 
  - **Triage Level:** STANDARD

### [ DONE ]
*(none)*

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
