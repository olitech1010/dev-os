---
name: shared-memory
description: Protocols for managing structured episodic and long-term memory across sessions, subagents, and decision milestones using the .agents/memory/ vault.
---

# Shared Memory Vault Protocol

The Shared Memory Vault provides persistent, structured memory across agent sessions, context compactions, and multi-agent workflows.

## Vault Structure

```
.agents/memory/
├── context.json              # Active machine-readable state (branch, milestone, blockers)
├── decisions/                # Architecture Decision Records (ADRs)
│   ├── ADR-000-template.md
│   └── ADR-001-*.md
└── handoffs/                 # Session continuity records
    ├── handoff-template.md
    └── handoff-YYYY-MM-DD.md
```

## 1. Architecture Decision Records (ADRs)
Whenever an architectural choice or breaking boundary is established:
1. Create a numbered document in `.agents/memory/decisions/` (e.g. `ADR-001-runtime-hooks.md`).
2. Follow the format in `ADR-000-template.md`.
3. Link the ADR in `docs/CURRENT_STATE.md`.

## 2. Session Handoffs
At the end of an intensive working session or when context compaction is approached:
1. Generate a handoff document in `.agents/memory/handoffs/` using `handoff-template.md` (or run `devos memory handoff`).
2. Record active tasks, uncommitted changes, blockers, and concrete next steps.
3. When resuming in a subsequent session, the working agent reads the most recent handoff to restore 100% context without token re-ingestion.

## 3. Coordinating Agents
- **Memory Manager**: Owns pruning, indexing, and validating the memory vault.
- **Orchestrator**: Consults ADRs and handoffs when triaging new tasks.
- **Developer / Architect**: Authors ADRs during inception and design phases.
