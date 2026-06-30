# Olives Technologies — Engineering OS

> Drop this `.agents/` folder into any new project. Your AI agents (Antigravity, Cursor, Claude Code, Gemini) will automatically discover these agents and skills.

## Quick Start

1. **Copy `.agents/` into your project root.**
2. **Pick your stack** — copy the relevant file from `skills/stacks/` into your project root (e.g., as `AGENTS.md` or `CLAUDE.md` depending on your tool).
3. **Start building** — tell your agent to read `.agents/AGENTS.md` and it will know how to behave.

## What's Inside

```
.agents/
├── AGENTS.md               ← Master agent roster, roles, and workflow protocols
├── agents/                 ← Agent system prompts (one per specialist)
│   ├── orchestrator.md     ← Tech lead — decomposes and delegates
│   ├── architect.md        ← Project inception and requirements
│   ├── developer.md        ← Writes production code
│   ├── researcher.md       ← Verifies packages, APIs, and facts
│   ├── reviewer.md         ← Code review gatekeeper
│   ├── tester.md           ← Writes and runs tests
│   ├── devops.md           ← Infrastructure and deployment
│   └── security.md         ← Vulnerability scanning
└── skills/                 ← Skills loaded by agents as needed
    ├── grill-me.md         ← Project inception interrogation
    ├── design.md           ← UI/UX design principles
    ├── token-optimization.md ← Minimize AI token costs
    ├── git-workflow.md     ← Branch strategy and PR standards
    ├── git-ops.md          ← Autonomous commit, push, and PR behavior
    ├── deployment-checklist.md ← Pre-deployment verification
    ├── project-requirements.md ← Requirements template
    ├── frontend-design/    ← Distinctive UI design guidance (anthropics)
    ├── react-best-practices/ ← React/Next.js performance rules (vercel)
    ├── ui-ux-pro-max/      ← Comprehensive UI/UX reference database
    ├── brainstorming/      ← Design-before-code workflow (superpowers)
    ├── executing-plans/    ← Plan execution discipline (superpowers)
    ├── backend-patterns/   ← Backend architecture patterns
    ├── browser-use/        ← Browser automation CLI skill
    └── stacks/             ← Stack-specific coding standards (copy per project)
        ├── nextjs.md
        ├── laravel.md
        ├── django.md
        └── react-native.md
```

## How It Works

### Starting a New Project

1. Tell your agent: *"You are acting as the Architect agent. Load `.agents/agents/architect.md` and the grill-me skill. Here is my project brief: [your idea]"*
2. The Architect produces a `PROJECT_REQUIREMENTS.md` — review and approve it.
3. The Orchestrator takes over and delegates to specialists.

### Building Features

Tell the Orchestrator what you want. It breaks the task down and routes to the right agents:

```
Orchestrator → Researcher (verify APIs) → Developer (implement) → Reviewer (check quality) → Tester (test) → Security (scan) → DevOps (deploy plan) → You (approve)
```

### Documentation & Reports

The agents are instructed to save all output artifacts — such as implementation plans, architecture specifications, security reports, and PRDs — into a `/docs` directory in the root of your project.

### Git Operations

Agents automatically commit, push, and create PRs as they work — see `skills/git-ops.md`.

## Core Principles

1. **Standards live in files, not heads.** Every rule an agent needs is written down.
2. **Agents are specialists, not generalists.** Each agent has one job.
3. **Human approval at gates.** No agent deploys without your confirmation.
4. **Tool-agnostic.** Works with Antigravity, Cursor, Claude Code, Gemini, and any agentic AI tool.
