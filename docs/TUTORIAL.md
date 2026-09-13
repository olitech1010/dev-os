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
   - **Git Pre-Commit Hook:** Install now (mechanical commit gate & secret scanner) vs Skip.
2. **Install hooks**: If skipped during init, run `.agents/scripts/install-hooks.sh` to install the Git pre-commit hook.
3. **Verify gitleaks**: The hook enforces secret scanning using `gitleaks`. Any commits containing secrets will be mechanically rejected.
4. **Check health**: Run `devos doctor` — it confirms all required checks pass.

## 3. Understanding the Agent Roster

You communicate primarily with the **Orchestrator** (or the **Executive Proxy** when in autonomous mode).
The Orchestrator delegates to specialist agents:
- **Architect**: Explores requirements and edge cases using `grill-me`.
- **UI Designer**: Crafts `docs/DESIGN.md` before frontend development starts (Mandatory Design Gate).
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
