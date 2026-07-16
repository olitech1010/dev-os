# Goal Description

The goal is to upgrade the Dev-OS environment to version 2.0 by addressing the four major architectural gaps identified in our industry analysis:
1. **State Management & Graph Orchestration**
2. **Sandboxed Execution Environments (ACI)**
3. **Long-Term Memory (RAG)**
4. **Automated CI/CD Feedback Loops**

This transformation will shift Dev-OS from being purely a collection of "markdown-based prompts and rules" into a fully programmatic, execution-ready autonomous framework.

> [!WARNING]
> ## User Review Required
> This is a massive shift in architecture. We are moving from a set of Markdown guidelines to building actual orchestration software (a CLI or local server) and infrastructure (Docker). Please review the proposed stack and approach below and provide feedback on how you'd like to proceed.

> [!IMPORTANT]
> ## Open Questions
> 1. **Language Choice:** For the programmatic orchestrator (Gap 1), should we build it in **TypeScript** or **Python**? (TypeScript is often preferred if your main stacks are Next.js, but Python has better ecosystem support for frameworks like LangGraph).
> 2. **Docker Dependency:** Are you comfortable making Docker a strict requirement for anyone using Dev-OS locally (for the sandboxed execution environment)?
> 3. **Prioritization:** Which gap would you like to tackle first? (I recommend starting with Gap 1: State Management or Gap 2: Sandboxing).

## Proposed Changes (Dev-OS 2.0 Roadmap)

---

### Phase 1: State Management & Graph Orchestration (The Engine)

We will build a lightweight local runner (e.g., a CLI tool named `dev-os-cli`) that enforces the workflow graph programmatically.

#### [NEW] `core/orchestrator/`
- A new directory containing the programmatic state machine.
- Will parse the `AGENTS.md` and `.agents/agents/*.md` files, injecting them into the chosen LLM API.
- Will enforce the `Developer -> Reviewer -> Human` node transitions in code, physically preventing the system from looping indefinitely or bypassing the Reviewer.

---

### Phase 2: Sandboxed Execution Environments (The Sandbox)

We will define an Agent-Computer Interface (ACI) so that agents can safely execute terminal commands and run tests without breaking the host machine.

#### [NEW] `.devcontainer/` or `docker/`
- Configuration files to spin up an isolated Docker container containing Node.js, PHP, Python, etc.
- Agents will be restricted to running their code evaluation and tests *inside* this container.
#### [NEW] `.agents/skills/sandboxing/SKILL.md`
- Instructions for the Developer and Tester agents on how to execute commands via the Docker sandbox interface.

---

### Phase 3: Automated CI/CD Feedback Loops (The Webhook)

We will create standard templates for GitHub Actions that hook back into the Dev-OS agents.

#### [NEW] `.github/workflows/dev-os-ci-agent.yml`
- A CI pipeline that runs tests on every push.
- If the pipeline fails, it will curl/webhook a local or hosted Dev-OS endpoint with the failure logs, automatically waking up the Researcher and Developer agents to propose a fix.

---

### Phase 4: Long-Term Memory (RAG)

We will introduce semantic search capabilities so agents can query past architectural decisions and massive codebases without token bloat.

#### [NEW] `core/memory/`
- A lightweight vector database setup (e.g., local ChromaDB or standard embedding script).
#### [NEW] `.agents/skills/semantic-memory/SKILL.md`
- A skill granting the Researcher and Architect agents the ability to index repositories and perform semantic queries (e.g., "Find all files related to user authentication").

## Verification Plan

### Automated Tests
- We will write unit tests for the programmatic state machine to ensure node transitions (Developer -> Reviewer -> Human) cannot be bypassed.

### Manual Verification
- We will run a "dry run" simulation of a feature request through the new CLI engine.
- We will attempt a destructive bash command via the Developer agent and verify that the Docker Sandbox contains it.
