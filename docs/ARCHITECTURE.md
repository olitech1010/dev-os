# System Architecture & Design Philosophy

## The Multi-Agent Paradigm

Dev-OS is designed on the principle of **Separation of Concerns**. Instead of relying on a single monolithic LLM prompt to architect, write, review, test, and deploy software, Dev-OS assigns distinct personas with specialized system prompts and rigid boundaries.

```
YOU (Engineering Lead)
        │
        ▼
 ORCHESTRATOR AGENT          ← You talk to this one
        │
   ┌────┼────────────────────────────────────────┐
   ▼    ▼         ▼         ▼        ▼           ▼
 DEV  RESEARCHER  TESTER  DEVOPS  SECURITY      DBA
  │
  ▼
  QA ← checks DEV output before it's accepted
  │
  ▼
🧑 HUMAN ← approves before commit (via commit.sh)
```

## Core Principles

### 1. Task Triage & Latency Optimization
A major failure mode of multi-agent systems is **over-engineering**. Spawning a Developer agent and a QA agent to fix a typo wastes tokens and time. Dev-OS solves this through **Triage Levels**:
- `TRIVIAL`: Small fixes are executed and committed directly by the Orchestrator.
- `STANDARD`: Feature work flows through Developer → QA → Human.
- `CRITICAL`: Database and security work involves specialized DBA and Security agents with mandatory dry-run plans.

### 2. Mechanical Human-in-the-Loop Guardrails
LLMs suffer from **Task Completion Bias**—when given a list of tasks, an agent's desire to check off "commit code" often causes it to ignore passive instructions like "wait for human approval." 
Dev-OS eliminates this by replacing raw `git commit` terminal commands with an executable bash script (`.agents/scripts/commit.sh`). The script physically halts terminal execution and requires a cryptographic/string token (`approve`) from the human before a commit can be recorded in version control.

### 3. Two-Phase Quality Assurance (QA)
To prevent the QA Agent from wasting tokens reasoning about code that doesn't even compile, Dev-OS enforces a strict two-phase review:
1. **Phase 1 (Automated):** The QA Agent must execute local CI tools (`npm run lint`, `pytest`, etc.). If syntax or tests fail, code goes immediately back to the Developer.
2. **Phase 2 (Manual Logic Review):** Only when automated tools pass does QA review architectural logic against `CODING_STANDARDS.md`.

### 4. Explicit Handoffs via Task Contracts
Agents communicate using structured **Task Contracts** (`.agents/skills/task-contract/SKILL.md`). When the Orchestrator delegates work, it must define:
- The exact target agent.
- The precise task description.
- The expected output schema or format.
- Any strict constraints or context needed.
