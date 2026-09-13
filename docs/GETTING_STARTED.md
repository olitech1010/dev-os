# Getting Started with Olives Dev-OS

This guide covers installing Dev-OS in a new or existing repository using the **Olives Dev-OS CLI** (`@olives/devos`), configuring your AI coding harness (including Google Antigravity, Claude Code, Cursor, OpenCode, and Codex), and executing multi-agent software development workflows.

---

## 1. Quick Installation

> **Package Identity:** The npm package is **`@olives/devos`**. The executable commands are `devos`, `olives-devos`, and `devos-init`.

### Option A: Interactive Wizard via NPX (Recommended)
Run the automated wizard in your target project directory:
```bash
npx @olives/devos init
```

If installed globally via `npm install -g @olives/devos`, run:
```bash
devos init
```

### Option B: Non-Interactive Flag Execution
For CI/CD pipelines, automated scripts, or fast bootstrapping:
```bash
npx @olives/devos init --stack nextjs --platform antigravity --mode auto --existing
```

### Option C: Direct GitHub Installation
Run directly from the upstream repository without using the npm registry:
```bash
npx github:olitech1010/dev-os init
```

### Option D: Local Linking (Offline Development)
```bash
git clone https://github.com/olitech1010/dev-os.git
cd dev-os
npm link
cd /path/to/your-target-project
devos init
```

---

## 2. The 8-Step Interactive Installation Wizard

When running `devos init` in an interactive terminal, the wizard walks you through 8 targeted configuration questions:

```
Step 1 · Environment Type
  1) Fresh Project (Initialize clean workspace with docs and default standards)
  2) Existing Project (Inject/update .agents team without modifying existing code or custom standards)

Step 2 · Technology Stack
  1) Next.js (TypeScript, Supabase, Vercel)
  2) Laravel (PHP, MySQL, cPanel/Forge)
  3) Django (Python, DRF, Celery, Redis)
  4) React Native (Expo Router, Zustand)
  5) Express (Node.js, TypeScript)
  6) FastAPI (Python, Pydantic)
  7) Universal / Standard Template (Default)

Step 3 · AI Coding Platform / Harness
  1) Google Antigravity / Gemini (ANTIGRAVITY.md, GEMINI.md, Agent Skills Standard) [Recommended]
  2) Claude Code (Anthropic Claude CLI, .claude/ commands, agents, hooks)
  3) Cursor (.cursor/rules/devos.mdc, .cursorrules)
  4) OpenCode (.opencode/rules/, OPENCODE.md)
  5) Codex / Windsurf (.codex/instructions.md, .windsurfrules)
  6) All Platforms (Universal Multi-Platform Setup) [Default]
  (You can enter comma-separated choices, e.g. 1,2)

Step 4 · Default SDLC Execution Mode
  1) Interactive (Default pair-programming with staged human reviews) [Recommended]
  2) Guided (Step-by-step confirmation checkpoints at each SDLC stage)
  3) Auto (Autonomous hands-off MVP builder for founders/CEOs — from idea to working software)
  4) Audit (Read-only security, architecture, and code health evaluation)

Step 5 · Autonomous Goal / Product Idea (Prompted if Mode is Auto)
  Enter the product, MVP, or feature idea you want Dev-OS to build autonomously.
  (Stored in docs/TASK_BOARD.md and .agents/manifest.json)

Step 6 · Capability Scope & Specialist Skills
  1) Lean Stack Pack (Core + target stack skills — token-optimized) [Recommended]
  2) Full Skills Arsenal (Install all 66 specialist skills across design, backend, devops)

Step 7 · Anonymous Failure Telemetry & Local RCA Buffer
  1) On (Recommended) — Anonymously captures execution errors & RCA reports in .agents/telemetry/
  2) Off — Completely disable anonymous failure logging

Step 8 · Git Pre-Commit Hook & Secret Gate
  1) Install Now (Mechanically enforce approval gate & gitleaks secret scanning) [Recommended]
  2) Skip (Install later via .agents/scripts/install-hooks.sh)
```

---

## 3. Platform Integrations

Dev-OS supports major agentic AI coding harnesses with parity:

### Google Antigravity & Gemini CLI
- Antigravity natively discovers and executes skills adhering to the open **Agent Skills Standard** in `.agents/skills/`.
- `devos init` generates `ANTIGRAVITY.md` and `GEMINI.md` at project root with explicit instructions for:
  - Multi-agent role delegation rules.
  - Solo session protocol for single-agent runs.
  - Mechanical commit gates and the Mandatory Design Gate (`docs/DESIGN.md`).
  - Standard testing passwords (`devos123`).

### Anthropic Claude Code
- Compiles agent personas into `.claude/agents/*.md` and slash commands into `.claude/commands/*.md`.
- Bootstraps `CLAUDE.md` with workspace standards and the Hard Rules digest.
- Wires lifecycle hooks in `.claude/hooks.json` to enforce session start synchronization and tool validations.

### Cursor IDE
- Generates `.cursor/rules/devos.mdc` and `.cursorrules` with context guidelines and skill index mappings.

### OpenCode & Codex / Windsurf
- Generates `.opencode/rules/devos-rules.md`, `OPENCODE.md`, `.codex/instructions.md`, and `.windsurfrules`.

---

## 4. SDLC Execution Modes

Dev-OS provides four execution modes configured in `.agents/manifest.json`:

| Mode | Target User | Description |
|------|-------------|-------------|
| `interactive` | Professional Developers | Default pair-programming workflow. Staged review before every commit. |
| `guided` | Engineering Leads / QA | Pauses after each SDLC stage (Inception, Design, Schema, Implementation, Testing) for sign-off. |
| `auto` | Startup Founders / CEOs | Hands-off MVP builder. The Executive Proxy manages the full 10-stage SDLC from prompt to working app. |
| `audit` | Security / Compliance | Read-only mode. Performs vulnerability scans, code reviews, and standards audits without modifying code. |

### Running Autonomous Mode (`devos run` or `/auto`)
To kick off an autonomous build from idea to working software:
```bash
devos run "Build an inventory management dashboard with Supabase auth and export features"
```
Inside your AI harness, trigger the pipeline with:
```text
/auto Build an inventory management dashboard with Supabase auth and export features
```
The **Executive Proxy Agent** oversees all 10 stages:
1. **Inception:** Architect creates `docs/PROJECT_REQUIREMENTS.md`.
2. **Design Gate:** UI Designer creates `docs/DESIGN.md` (required before UI coding).
3. **Database Architecture:** DBA writes migrations and seed scripts with universal test credentials (`devos123`).
4. **Task Decomposition:** Orchestrator creates dependency DAG in `docs/TASK_BOARD.md`.
5. **Implementation:** Developer implements components and services.
6. **Test Suite:** Tester writes unit, integration, and regression tests.
7. **Interactive Guide:** Tester creates `docs/TESTING_GUIDE.md` for human reviewers.
8. **QA Gate:** QA evaluates types, lint rules, and design specifications.
9. **Security Scan:** Security agent evaluates OWASP vulnerabilities and secrets.
10. **Humanizer Gate:** Release Manager de-fluffs documentation and copies.

---

## 5. Complete CLI Command Reference

| Command | Aliases | Description |
|---------|---------|-------------|
| `devos init` | `setup` | Interactive or non-interactive installer wizard. |
| `devos update` | `upgrade` | Refreshes agent personas, skills, commands, harnesses, and memory templates safely. |
| `devos run <goal>` | `auto` | Autonomous SDLC runner for hands-off MVP builds. |
| `devos doctor` | `check` | Verifies agent files, scripts, permissions, memory vault, and harness configurations. |
| `devos telemetry` | — | Manages anonymous failure telemetry buffer (`status`, `report`, `enable`, `disable`, `clear`). |
| `devos pack` | `packs` | Inspects and installs stack capability packs (`pack list`, `pack add <name>`). |
| `devos skill` | `skills` | Discovers and installs individual skills (`skill list`, `skill add <name>`, `skill find <query>`). |
| `devos memory` | — | Inspects persistent memory vault (`memory list`, `memory doctor`, `memory handoff`). |
| `devos list` | `agents` | Lists active agents and installed capability skills. |
| `devos status` | — | Shows project stack, platform, execution mode, telemetry status, and health summary. |
| `devos version` | — | Displays version number and runtime environment details. |

### Available CLI Flags
```text
  -s, --stack <name>       Target stack (nextjs, laravel, django, react-native, express, fastapi, universal)
  -p, --platform <name>    Target AI harness (antigravity, claude, cursor, opencode, codex, all)
  -m, --mode <name>        Execution mode (interactive, guided, auto, audit)
  --all-skills             Install all 66 specialist skills
  --all-harnesses          Generate configs for all supported AI coding platforms
  --fresh                  Non-interactive fresh project initialization
  --existing               Non-interactive existing project initialization
  --no-claude              Skip generating .claude/ integration files
  --no-hooks               Skip wiring runtime lifecycle hooks (.claude/hooks.json)
  --no-telemetry           Disable anonymous failure telemetry
  --telemetry              Explicitly enable anonymous failure telemetry
  --json                   Output diagnostic and listing results as JSON
  -q, --quiet              Suppress header banners and non-essential logs
  -v, --version            Display version
  -h, --help               Display help screen
```

---

## 6. Mechanical Gates & Safety Rules

Dev-OS enforces code quality through automated runtime gates:

1. **Mechanical Commit Gate:** Raw `git commit` is blocked by pre-commit hooks. Changes must be committed using `.agents/scripts/commit.sh` or with `DEVOS_COMMIT_APPROVED=true`.
2. **Mandatory Design Gate:** Modifying frontend UI files (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`) without an approved `docs/DESIGN.md` is blocked by `.agents/hooks/pre-tool-use.sh`.
3. **Mechanical Humanizer Gate:** Documentation in `docs/` must pass `.agents/scripts/humanize-check.sh` to remove robotic text patterns before merging.
4. **Universal Test Password:** Standard test accounts and seed fixtures must use `devos123` to eliminate authentication friction for human testers.
5. **Zero Secret Policy:** API keys and credentials must never be committed or written into repository files.

---

## 7. Related Documentation

- [System Architecture](ARCHITECTURE.md)
- [Step-by-Step Tutorial](TUTORIAL.md)
- [Mechanical Pre-Commit Hook Reference](PRE_COMMIT_HOOK.md)
- [Task Board State Governance](TASK_BOARD.md)
- [Root Repository README](../README.md)
