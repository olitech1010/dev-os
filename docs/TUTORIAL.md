# Dev-OS Tutorial

Welcome to Dev-OS! This step-by-step guide will walk you through using the Engineering OS.

## 1. What is Dev-OS?

Dev-OS is an AI-augmented Engineering Operating System. Instead of a single AI assistant, you have a full development team comprising an Orchestrator, Developer, QA, Tester, Security, and more. They follow strict workflows, require human approval for critical steps, and prevent common AI mistakes through mechanical gates.

## 2. Setting up Dev-OS

1. **Install Dev-OS**: From your project root, run `npx @olives/devos init` (see [Getting Started](GETTING_STARTED.md) for details). The 8-step wizard configures:
   - **Environment:** Fresh workspace vs Existing codebase.
   - **Tech Stack:** Next.js, Laravel, Django, React Native, Express, FastAPI, or Universal template.
   - **AI Coding Harness:** Google Antigravity & Gemini (`ANTIGRAVITY.md`, `GEMINI.md`, Agent Skills Standard) [Recommended], Claude Code, Cursor, OpenCode, Codex, or All Platforms.
   - **SDLC Mode:** `interactive` (default pair programming), `guided` (checkpoint approvals), `auto` (autonomous hands-off MVP builder for founders/CEOs), or `audit`.
   - **Autonomous Goal:** Target MVP idea if running in `auto` mode (recorded into `docs/TASK_BOARD.md`).
   - **Skills Depth:** Lean Stack Pack (token-optimized) vs Full Skills Arsenal (all 66 specialist skills).
   - **Anonymous Failure Telemetry:** On (buffers execution failures locally in `.agents/telemetry/events.jsonl` with zero secret exposure) vs Off.
   - **Verification & Secret Gate:** Automatically verifies, installs, or updates Gitleaks, installs git pre-commit hook, and wires runtime lifecycle hooks (with zero-dependency built-in regex scanner fallback).
2. **Check health**: Run `devos doctor` — it confirms all required checks pass out of the box. No manual hook or secret scanner installation is needed.

## 3. Understanding the Agent Roster

You communicate primarily with the **Orchestrator** (or the **Executive Proxy** when in autonomous mode).
The Orchestrator delegates to specialist agents:
- **Architect**: Explores requirements and edge cases using `grill-me`.
- **UI Designer**: Crafts `DESIGN.md` at project root before frontend development starts (Mandatory Design Gate).
- **DBA & DevOps**: Database migrations, seed fixtures, infrastructure, and deployment pipelines.
- **Developer**: Writes code and presents work for staged review.
- **QA, Tester, Security**: The parallel quality gate. Tester authors unit tests and `docs/TESTING_GUIDE.md` (universal password: `devos123`).
- **Telemetry & Eval Engineer**: Local failure diagnostics and test benchmark harnesses.
- **Memory Manager & Release Manager**: Handles state tracking (`CURRENT_STATE.md`, `LESSONS.md`), changelogs, and document de-fluffing.

For a full breakdown, see `../.agents/AGENTS.md`.

## 4. Using Slash Commands

Slash commands let you explicitly trigger a workflow or a specific agent.

*Examples:*
- `/test src/auth/login.js` -> Triggers the Tester to write/run tests for the login module.
- `/secure` -> Asks the Security agent to audit the codebase.
- `/architect Build a user profile page` -> Runs the `grill-me` skill to define requirements.

See [Slash Commands Reference](SLASH_COMMANDS.md) for more details.

## 5. Understanding the Workflow

### Standard Feature Delivery
1. Orchestrator delegates to Developer.
2. Developer writes code.
3. **Parallel Gate**: QA checks standards, Tester runs/writes tests, Security scans for vulnerabilities.
4. Human approves.

### Bug Fix
1. Researcher finds the root cause.
2. Developer fixes it.
3. Tester writes a regression test.
4. QA approves.
5. Human approves.

## 6. Memory System

Dev-OS maintains its own context to prevent token overload and "forgetting".
- `CURRENT_STATE.md`: Tracks the current state of the project.
- `LESSONS.md`: Episodic memory of past mistakes and architectural decisions.
- **Pinned Rules**: Always present in the agent's context.

## 7. Commit Workflow (commit.sh)

Agents cannot run raw `git commit`. Changes are staged with `git add`, then the human runs `.agents/scripts/commit.sh`. The script:
1. Prompts for the human approval token.
2. Prompts for the commit type and message.
3. Exports `DEVOS_COMMIT_APPROVED`.
4. Runs `git commit`, which passes through the Git pre-commit hook.

Note: the script does **not** stage files — run `git add` before invoking it.

## 8. Best Practices and Tips

- **Review the plans**: Always read what the DevOps or DBA agents plan to do before approving.
- **Use /status**: If you lose track, type `/status` to have the Orchestrator summarize the situation from `CURRENT_STATE.md`.
- **Let them loop, but not forever**: Agents have a Circuit Breaker (3 iterations). If they fail 3 times, they will escalate to you.

## 9. How to Prompt Dev-OS: Prompt the What, Not the How

When working with standard AI assistants, you often have to micromanage them: remind them not to hallucinate, tell them to write tests, ask them to make the UI mobile friendly, and warn them not to leak API keys.

Dev-OS is an operating system with mechanical rules and specialist agents. You do not need to manage the internal engineering process.

### What You Can Leave Out

You can omit these instructions from your prompts:

- **"Mount as orchestrator" or "Follow Dev-OS rules"**: The harness configuration files (`CLAUDE.md`, `ANTIGRAVITY.md`, `OPENCODE.md`) bind the agents automatically at session start.
- **"Do not write code until you prompt me for .env keys"**: Hard Rule #2 and pre-tool hooks block secret hardcoding. When external services (Supabase, Paystack, Stripe) are involved, the DBA and Developer pause and request environment variables before running migrations.
- **"Grill me and brainstorm first"**: When given a high-level goal in autonomous mode (`/auto`), the Architect agent runs `grill-me` and authors `docs/PROJECT_REQUIREMENTS.md`.
- **"Make it mobile responsive and clean"**: The UI Designer agent must author `DESIGN.md` at the project root before anyone writes frontend code. The hook `.agents/hooks/pre-tool-use.sh` blocks UI files until tokens for mobile, tablet, and desktop breakpoints are established.
- **"Write unit tests and manual instructions"**: The Tester agent is obligated to produce automated test suites and the walkthrough guide in `docs/TESTING_GUIDE.md` using the universal password `devos123`.

### Case Study: Restaurant POS & Voice Ordering

Here is an example based on an actual user prompt.

#### The Over-Instructed Prompt (400 words)

> *"use devos rules, mount on as the orchestrator, i want to use auto mode to build a management system for a restaurant, a small one, mini restaurant, only one branch where she can get like a pos, to manage the business and get daily weekly and monthly reports... i want to use ai in the project where in the case she is too busy to use the system, she can speak to the ai assistant called Olives then olives will take the instructions and do it in the system. we will print a qr code and put it at the place where customers can scan for menu and place order online and pay via paystack. i will provide paystack keys and gemini api keys in the .env file. after nextjs is installed prompt me for api keys and supabase credentials in the .env file before you can start using them to code. leave space for advertising slideshow. grill, brainstorm, research, and work on this product, create a private repo on git and use vercel to deploy, mcp is connected so you can create project and all you need..."*

#### The Refined Dev-OS Prompt (5 bullets)

```text
/auto Build a single-location restaurant management and POS web app in Next.js and Supabase.

Core capabilities:
- Staff POS with a hands-free voice AI assistant named "Olives" (via Gemini) to record orders.
- Table QR code customer ordering with Paystack checkout.
- Marketing & sales: Ad banner carousel, custom bulk event order inquiries, and gift packages.
- Daily, weekly, monthly, and annual sales reports, with full admin CRUD for menus and pricing.
- Seed data: Initial menu items and prices documented in /docs.
```

### The Golden Prompt Formula

Use this template for new features or complete MVPs:

```text
/auto Build a [product] for [target user].
Features: [key capabilities and user workflows]
Integrations: [database / auth / payments / external APIs]
Seed data: [initial sample items or assets in /docs]
```

### Example: B2B Feedback Platform

```text
/auto Build a team pulse feedback web application in Next.js and Supabase.
Features: Weekly anonymous 3-question pulse surveys, manager team sentiment dashboard, Slack notifications.
Integrations: Supabase Auth, Slack Webhooks.
Seed data: 3 sample departments with mock response history.
```
