# Olives Technologies Engineering OS (Dev-OS)

Welcome to **Olives Dev-OS**, a premier agentic development environment engineered for autonomous, high-quality software delivery under strict human-in-the-loop constraints.

---

## 1. What is Olives Dev-OS?

Olives Dev-OS is an operating system for engineering teams that utilizes specialized AI agents (Orchestrator, Developer, QA, DBA, DevOps, etc.) to collaboratively build, test, and ship software. Instead of relying on a single AI model to do everything, Dev-OS separates responsibilities into distinct personas with mechanical guardrails and strict quality gates.

---

## 2. Standard CLI Installation & Commands

The **Olives Dev-OS CLI** (`devos` / `olives-devos`) is a zero-dependency command-line interface designed to match modern developer tool standards (Claude Code, Gemini CLI, gh, Vercel).

### Installation Methods

#### Method A: Global NPM / NPX (Recommended)
Run the automated installer directly in your project root:
```bash
npx devos init
```
*(Or install globally: `npm install -g devos` and then run `devos init`)*

#### Method B: Non-Interactive Flag Execution
```bash
npx devos init --stack nextjs --existing
```

#### Method C: Directly from GitHub
```bash
npx github:olitech1010/dev-os init
```

#### Method D: Local Cloning & Linking (Offline / Fallback Method)
If `npx` or global installation fails (e.g., offline environment or permission restrictions):
```bash
# 1. Clone the repository to your machine
git clone https://github.com/olitech1010/dev-os.git
cd dev-os

# 2. Register the CLI globally on your system
npm link

# 3. Navigate to your target project folder and run the installer
cd /path/to/your-target-project
devos init
```

### CLI Command Reference

| Command | Flags | Description |
| :--- | :--- | :--- |
| `devos init` | `-s, --stack`, `--fresh`, `--existing`, `-q` | Initialize or update Dev-OS in target directory |
| `devos doctor` | `--json`, `-q` | Run system diagnostic check on permissions, gates, and files |
| `devos list` | `--json` | List active agent personas and installed specialist skills |
| `devos status` | `-q` | Show active project setup, detected stack, and health |
| `devos version` | `-v, --version` | Output CLI version, Node runtime, and environment path |
| `devos help` | `-h, --help` | Display standard CLI help reference |

---

## 3. System Architecture & Agent Roster

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

## 4. Key Features

- **Task Triage Levels (`TRIVIAL`, `STANDARD`, `CRITICAL`):** Prevents over-engineering by allowing small fixes to bypass the multi-agent loop while enforcing strict gates for feature and database work.
- **Mandatory Automated QA:** The QA Agent must run local linter and test suites (`npm run lint`, `pytest`) before evaluating code logic.
- **Dedicated DBA Agent:** Offloads database schemas, migrations, and Row Level Security (RLS) policies to a database specialist.
- **Hardcoded Human Checkpoint:** Agents are physically forbidden from running raw `git commit` commands. They must execute `./.agents/scripts/commit.sh`, which prompts you for an approval token before making version control changes.
- **Task Contracts:** Clear boundary definitions and standardized communication protocols between agents.

---

## 5. Documentation & User Guides

Explore our detailed guides by clicking the links below:

- [Getting Started Guide](file:///Users/user/development/dev-os/docs/GETTING_STARTED.md): How to initialize and run Dev-OS in your project.
- [System Architecture](file:///Users/user/development/dev-os/docs/ARCHITECTURE.md): Deep dive into the multi-agent paradigm and triage rules.
- [Step-by-Step Tutorial & Glossary](file:///Users/user/development/dev-os/docs/TUTORIAL.md): A beginner-friendly walkthrough explaining how to use Dev-OS, how agents interact, and how to delegate tasks effectively.
