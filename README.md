# 🧠 Olives Technologies — Engineering OS

> A production-grade, AI-native engineering system for professional solo developers and small teams. Designed to work with Claude Code, Cursor, Gemini, and any agentic AI tool. Built to grow through community contributions.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## What Is This?

This is not a code starter kit. It is an **engineering operating system** — the standards, agent definitions, workflow protocols, and decision frameworks that a professional software team runs on.

Clone this into any new project. Point your AI tools at it. Your agents will know how to behave, your commits will be consistent, your deployments will be safe, and your team (human or AI) will work like a seasoned unit.

---

## Who Is This For?

- **Solo developers** who use Claude Code, Cursor, Gemini, or similar AI agents
- **Small teams** who want professional-grade workflow standards
- **Developers starting new projects** across any stack
- **All kinds of engineers** — frontend, backend, mobile, DevOps, data, embedded
- **Open source contributors** who want to share stack-specific knowledge

---

## Quick Start

```bash
# Clone into your new project directory
git clone https://github.com/olivestechnologies/starter.git .engineering

# Or use as a GitHub template (click "Use this template" above)
```

Then pick your stack:

```
.engineering/stacks/
├── nextjs/        → Next.js 14+ (App Router, TypeScript, Tailwind)
├── laravel/       → Laravel 11+ (API or fullstack)
├── django/        → Django 5+ (DRF or fullstack)
├── react-native/  → React Native with Expo
└── flutter/       → Flutter (Dart)
```

Copy your chosen stack's `CLAUDE.md` and `CODING_STANDARDS.md` into your project root.

---

## Repo Structure

```
olivestechnologies-starter/
│
├── README.md                    ← You are here
├── CONTRIBUTING.md              ← How to contribute to this repo
├── CHANGELOG.md                 ← Version history
│
├── .github/
│   ├── ISSUE_TEMPLATE/          ← Bug reports, feature requests, stack additions
│   └── workflows/               ← CI checks for the repo itself
│
├── agents/                      ← AI agent definitions and system prompts
│   ├── README.md                ← How the agent system works
│   ├── AGENTS.md                ← Master agent roster and roles
│   ├── orchestrator/            ← Orchestrator agent prompt
│   └── prompts/                 ← Individual agent system prompts
│       ├── architect.md         ← 🏛️ Grill-me inception agent
│       ├── developer.md
│       ├── researcher.md
│       ├── reviewer.md
│       ├── tester.md
│       ├── devops.md
│       └── security.md
│
├── docs/                        ← Engineering documentation standards
│   ├── ARCHITECTURE.md          ← How to document system architecture
│   ├── DECISIONS.md             ← Architecture Decision Records (ADR) template
│   ├── ROADMAP.md               ← How to maintain a project roadmap
│   ├── decisions/               ← Example ADR entries
│   └── guides/                  ← Deep-dive guides
│       ├── git-workflow.md
│       ├── code-review.md
│       ├── deployment-checklist.md
│       └── security-checklist.md
│
├── skills/                      ← AI tool skill configs (per tool)
│   ├── CLAUDE.md                ← Global Claude Code context (universal)
│   ├── cursor.md                ← Cursor rules (universal)
│   ├── design.md                ← Design system principles for AI agents
│   ├── grill-me.md              ← Matt Pocock-style project interrogation skill
│   └── token-optimization.md    ← Token usage optimization strategies
│
├── stacks/                      ← Stack-specific standards (pick one per project)
│   ├── nextjs/
│   │   ├── CLAUDE.md            ← Claude context for Next.js projects
│   │   ├── CODING_STANDARDS.md  ← Next.js coding conventions
│   │   ├── DEPLOYMENT.md        ← Deployment guide (Vercel, Railway, etc.)
│   │   └── cursor.rules         ← Cursor rules for Next.js
│   ├── laravel/
│   │   ├── CLAUDE.md
│   │   ├── CODING_STANDARDS.md
│   │   └── DEPLOYMENT.md
│   ├── django/
│   │   ├── CLAUDE.md
│   │   ├── CODING_STANDARDS.md
│   │   └── DEPLOYMENT.md
│   ├── react-native/
│   │   ├── CLAUDE.md
│   │   ├── CODING_STANDARDS.md
│   │   └── DEPLOYMENT.md
│   └── flutter/
│       ├── CLAUDE.md
│       ├── CODING_STANDARDS.md
│       └── DEPLOYMENT.md
│
└── templates/                   ← Copy-paste templates for project assets
    ├── pull_request/
    │   └── PULL_REQUEST_TEMPLATE.md
    └── project_init/
        ├── CONTRIBUTING.md      ← Template for your own project's CONTRIBUTING
        ├── DECISIONS.md         ← Empty ADR log to start from
        └── PROJECT_REQUIREMENTS_TEMPLATE.md ← Output format for grill-me inception
```

---

## 🏛️ Project Inception (Grill-Me Workflow)

Before writing a single line of code, the Architect agent interrogates your project idea:

```
1. You provide a rough project brief
2. Architect agent applies the grill-me skill (zero-shot, token-optimized)
3. Generates a PROJECT_REQUIREMENTS.md covering:
   → Core workflows, architecture, edge cases, non-functional requirements
   → Open questions it couldn't deduce from your brief
4. You review, tweak, and approve
5. Orchestrator proceeds with the approved spec
```

This ensures no ambiguity leaks into development. One agent call, not a 20-message debate.

---

## Core Principles

1. **Standards live in files, not heads.** Every rule an agent needs to follow is written down.
2. **Agents are specialists, not generalists.** Each agent has one job and does it well.
3. **Human approval at gates.** No agent touches production without explicit confirmation.
4. **Token-conscious.** Agent prompts and workflows are designed to minimize token usage and cost.
5. **Community-maintained.** This repo gets better as more engineers contribute stack knowledge.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Adding a new stack, improving an agent prompt, or sharing a deployment pattern are all welcome.

---

## License

MIT — use this freely, in personal or commercial projects.
