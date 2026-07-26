# System Architecture & Design Philosophy

## 1. The Multi-Agent Paradigm

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
HUMAN ← approves before commit (via commit.sh)
```

---

## 2. Core Principles

### Task Triage & Latency Optimization
A major failure mode of multi-agent systems is **over-engineering**. Spawning a Developer agent and a QA agent to fix a typo wastes tokens and time. Dev-OS solves this through **Triage Levels**:
- `TRIVIAL`: Small fixes are executed and committed directly by the Orchestrator.
- `STANDARD`: Feature work flows through Developer → QA → Human.
- `CRITICAL`: Database and security work involves specialized DBA and Security agents with mandatory dry-run plans.

### Mechanical Human-in-the-Loop Guardrails
LLMs suffer from **Task Completion Bias**—when given a list of tasks, an agent's desire to check off "commit code" often causes it to ignore passive instructions like "wait for human approval." 
Dev-OS eliminates this by replacing raw `git commit` terminal commands with an executable bash script (`.agents/scripts/commit.sh`). The script physically halts terminal execution and requires a cryptographic/string token (`approve`) from the human before a commit can be recorded in version control.

### Two-Phase Quality Assurance (QA)
To prevent the QA Agent from wasting tokens reasoning about code that does not compile, Dev-OS enforces a strict two-phase review:
1. **Phase 1 (Automated):** The QA Agent must execute host lint/test commands from `.agents/project.json` → `commands` (fallback only if config is missing). If syntax or tests fail, code goes immediately back to the Developer.
2. **Phase 2 (Manual Logic Review):** Only when automated tools pass does QA review architectural logic against `CODING_STANDARDS.md`.

### Stack catalog, detection, and docs knowledge
- **Stack** = framework identity (`hono`, `nextjs`, …). **Runtime** = inferred host runtime (`bun`, `node`, `python`, …).
- `devos init` detects the host, writes `.agents/project.json`, and selects deep/thin coding standards.
- Researcher prefers `.agents/knowledge/` (filled by `devos sync-docs`) and official `docsSources` — never invent APIs when docs are reachable.

### Explicit Handoffs via Task Contracts
Agents communicate using structured **Task Contracts** (`.agents/skills/task-contract/SKILL.md`). When the Orchestrator delegates work, it defines:
- Target agent.
- Precise task description.
- Expected output schema or format.
- Strict constraints or context.

---

## 3. Navigation & Documentation

- [Getting Started Guide](./GETTING_STARTED.md)
- [Step-by-Step Tutorial & Glossary](./TUTORIAL.md)
- [Root README](../README.md)
