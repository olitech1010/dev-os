# Dev-OS Tutorial

Welcome to Dev-OS! This step-by-step guide will walk you through using the Engineering OS.

## 1. What is Dev-OS?

Dev-OS is an AI-augmented Engineering Operating System. Instead of a single AI assistant, you have a full development team comprising an Orchestrator, Developer, QA, Tester, Security, and more. They follow strict workflows, require human approval for crucial steps, and prevent common AI mistakes through mechanical gates.

## 2. Setting up Dev-OS

1. **Install Dev-OS**: From your project root, run `npx @olives/devos init` (see [Getting Started](GETTING_STARTED.md) for all installation options). This installs `.agents/`, generates the Claude Code integration in `.claude/`, and sets up your coding standards.
2. **Install hooks**: Run `.agents/scripts/install-hooks.sh`. This sets up Git hooks.
3. **Verify gitleaks**: The hook enforces secret scanning using `gitleaks`. Any commits containing secrets will be mechanically rejected.
4. **Check health**: Run `devos doctor` — it must report all required checks passing.

## 3. Understanding the Agent Roster

You communicate primarily with the **Orchestrator**. 
The Orchestrator delegates to:
- **Architect**: Designs the system and requirements.
- **Developer**: Writes the code.
- **QA, Tester, Security**: The parallel quality gate.
- **DBA, DevOps**: Infrastructure and databases.
- **Memory Manager & Release Manager**: Handles state, context, and versioning.

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
