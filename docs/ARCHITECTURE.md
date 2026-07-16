# System Architecture

## The Multi-Agent Paradigm

```
YOU (Engineering Lead)
        │
        ▼
 ORCHESTRATOR AGENT
        │
   ┌────┼────────────────────────────────┐
   ▼    ▼         ▼         ▼        ▼
 DEV  RESEARCHER  TESTER  DEVOPS  SECURITY
  │
  ▼
REVIEWER
  │
  ▼
🧑 HUMAN (Commit Gate)
```

## Core Principles
1. **Separation of Concerns:** Each agent has a single responsibility.
2. **Human-in-the-Loop:** Agents are powerful but can loop or hallucinate. The human acts as the final gate before irreversible actions (commits, deploys).
3. **Explicit Handoffs:** Agents use Task Contracts to pass work explicitly.
