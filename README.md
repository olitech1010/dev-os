# Olives Technologies Engineering OS (Dev-OS)

Welcome to **Dev-OS**, a premier agentic development environment engineered for autonomous, high-quality software delivery under strict human-in-the-loop constraints.

## 🌟 What is Dev-OS?
Dev-OS is an operating system for engineering teams that utilizes specialized AI agents (Orchestrator, Developer, QA, DBA, DevOps, etc.) to collaboratively build, test, and ship software. Instead of relying on a single AI model to do everything, Dev-OS separates responsibilities into distinct personas with mechanical guardrails and strict quality gates.

## 🏗️ Architecture & Roster
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

## 🚀 Key Features
- **Task Triage Levels (`TRIVIAL`, `STANDARD`, `CRITICAL`):** Prevents over-engineering by allowing small fixes to bypass the multi-agent loop while enforcing strict gates for feature and database work.
- **Mandatory Automated QA:** The QA Agent must run local linter and test suites (`npm run lint`, `pytest`) before evaluating code logic.
- **Dedicated DBA Agent:** Offloads database schemas, migrations, and Row Level Security (RLS) policies to a database specialist.
- **Hardcoded Human Checkpoint:** Agents are physically forbidden from running raw `git commit` commands. They must execute `./.agents/scripts/commit.sh`, which prompts you for an approval token before making version control changes.
- **Task Contracts:** Clear boundary definitions and standardized communication protocols between agents.

## 📖 Documentation & Tutorials
- [Getting Started Guide](file:///Users/user/development/dev-os/docs/GETTING_STARTED.md): How to initialize and run Dev-OS in your project.
- [System Architecture](file:///Users/user/development/dev-os/docs/ARCHITECTURE.md): Deep dive into the multi-agent paradigm and rules.
- [Step-by-Step Tutorial](file:///Users/user/development/dev-os/docs/TUTORIAL.md): A beginner-friendly walkthrough explaining how to use Dev-OS, how agents interact, and how to delegate tasks effectively.
