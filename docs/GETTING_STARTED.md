# Getting Started with Dev-OS

This guide explains how to initialize Dev-OS in a new or existing repository and start collaborating with your multi-agent engineering team.

## 1. Project Inception (The "Grill-Me" Phase)
When starting a new feature or project, avoid jumping straight into code:
- Instruct the Orchestrator or Architect agent to trigger the `.agents/skills/grill-me/SKILL.md` protocol.
- The Architect will interview you to uncover hidden technical constraints, edge cases, and architectural needs.
- This produces a concrete `docs/PROJECT_REQUIREMENTS.md` document for you to review and approve.

## 2. Setting Your Coding Standards & Stack
Before writing code, ensure your standards are defined:
- Copy the appropriate stack file from `.agents/skills/stacks/` into your project root (e.g., `CODING_STANDARDS.md` or `nextjs.md`).
- Supported stacks include Next.js, Laravel, Django, and React Native.

## 3. The Development Workflow & Task Triage
When you assign a task to the **Orchestrator Agent**, it will automatically triage your request:

1. **TRIVIAL Tasks (Typos, small config changes, minor CSS):**
   - The Orchestrator will execute the fix directly without spawning subagents, saving you latency and token costs.
2. **STANDARD Tasks (New features, standard bug fixes):**
   - The Orchestrator delegates to the **Developer Agent**.
   - The Developer writes the implementation and tests.
   - The Developer hands off to the **QA Agent**.
   - The QA Agent runs automated checks (`npm run lint`, `pytest`). If they fail, code goes back to the Developer. If they pass, QA checks against `CODING_STANDARDS.md` and asks for your approval.
3. **CRITICAL Tasks (Database schemas, Supabase RLS, infrastructure):**
   - The Orchestrator involves the **DBA Agent**, **Security Agent**, or **DevOps Agent**.
   - Destructive actions (`DROP`, `TRUNCATE`, deployments) require a mandatory dry-run plan and explicit human approval before execution.

## 4. Approving Commits (The Scripted Checkpoint)
In Dev-OS, agents are mechanically forbidden from running raw `git commit` commands in the terminal. When code is ready to be saved:
1. The agent calls `./.agents/scripts/commit.sh`.
2. The execution pauses and prompts you in the terminal:
   ```
   Human Approval Token (type 'approve' to proceed):
   ```
3. Type `approve` and press Enter.
4. The script formats the commit using Conventional Commits and saves your progress securely!

## 5. Deployment
Once features are verified and merged to `main`, instruct the **DevOps Agent** to prepare a deployment plan. Review the checklist in `.agents/skills/deployment-checklist/SKILL.md`, give your final sign-off, and deploy to production.
