# Olives Technologies Engineering OS (Dev-OS)

Welcome to **Dev-OS**, a premier agentic development environment engineered for autonomous, high-quality software delivery under strict human-in-the-loop constraints.

---

## 1. What is Dev-OS?

Dev-OS is an operating system for engineering teams that utilizes specialized AI agents (Orchestrator, Developer, QA, DBA, DevOps, etc.) to collaboratively build, test, and ship software. Instead of relying on a single AI model to do everything, Dev-OS separates responsibilities into distinct personas with mechanical guardrails and strict quality gates.

It configures **agent packs + host project metadata** — it is not an application scaffolder.

---

## 2. Installation & Quick Start

```bash
npx devos init
```

Other commands:

| Command | Purpose |
|---------|---------|
| `devos init` | Detect stack/runtime, install `.agents/`, write `.agents/project.json` |
| `devos init --yes` | Non-interactive init |
| `devos sync-docs` | Cache allowlisted official docs into `.agents/knowledge/` |
| `devos test` | Run Tester suite (`commands.test`; fallback `bun test`) |
| `devos qa` | Run QA suite (`commands.qa`; fallback `npm run lint`) |
| `devos list` | List agents, skills, and catalog stacks |
| `devos doctor` | Diagnose install health |

Global install: `npm install -g devos`. From GitHub: `npx github:olitech1010/dev-os init`.

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

**Stack vs runtime:** Stack is the framework (`hono`, `nextjs`, …). Runtime (`bun`, `node`, `python`, …) is inferred from the host and stored in `.agents/project.json`.

**Catalog (v1):** Deep packs for Hono, Next.js, Laravel, Django, React Native; thin packs for React/Vite, Vue/Nuxt, SvelteKit, Express, Fastify, NestJS, FastAPI, Flutter, Electron, Tauri, Universal.

---

## 4. Key Features

- **Detect-first init:** Proposes stack/runtime/libraries from the host project; confirm or override.
- **Project config:** `.agents/project.json` drives QA/Tester commands and Researcher docs sources.
- **Hybrid docs:** Curated sources + `devos sync-docs` knowledge cache (no arbitrary site crawl).
- **Task triage:** `TRIVIAL` / `STANDARD` / `CRITICAL`.
- **Human commit gate:** `./.agents/scripts/commit.sh` — agents cannot raw `git commit`.

---

## 5. Documentation

- [Getting Started](docs/GETTING_STARTED.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Tutorial & Glossary](docs/TUTORIAL.md)

---

## 6. Contributing / developing Dev-OS itself

Tests for this package use Bun, invoked through the CLI itself:

```bash
npm install       # installs bun as a devDependency when needed
npx devos test    # or: npm test (Tester suite → bun test)
npx devos qa      # or: npm run qa (QA suite; configure via commands.qa)
```

The published CLI stays zero **runtime** dependencies and runs on any Node-compatible runtime (`node`, `bun`, `deno`, …).
