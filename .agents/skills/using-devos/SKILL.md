---
name: using-devos
description: "Use when starting any Dev-OS session or task, before any other action. Explains how to find and load skills, which skill gates a feature, fix, UI change, commit or review, and where the Hard Rules and roster live."
---

# Using Dev-OS

Check for a skill before you act. If a skill might apply, load it first. This holds for
questions, exploration and clarifying questions too. Thinking "this is simple" or "I
remember it" is the signal to load it anyway; skills change.

## Loading a skill

Skills are listed by name and description. Load the body only when it applies.

- Claude Code: the `Skill` tool, or `/skill-name`.
- Codex: `$skill-name`, or `/skills`.
- OpenCode: the `skill` tool.
- Antigravity CLI: the `activate_skill` tool.
- Cursor: it loads a skill when the task matches; `/skill-name` forces one.

## Priority

1. The Hard Rules in `.agents/AGENTS.md`. They are enforced by hooks where the harness has them.
2. The human's direct instructions.
3. Skills.
4. Your defaults.

## Which skill gates which work

| Work | Load first |
|---|---|
| New feature or behaviour change | `brainstorming`, then `writing-plans` (or `spec-driven` for a multi-task feature). No production code before an approved plan (R22). |
| Bug or failing test | `qa`, then the stack skill. After 3 failed fixes, stop (R10). |
| UI work | `anti-ai-ui`; a root `DESIGN.md` must exist first. |
| Commit or push | `git-ops`. Commits go through `.agents/scripts/commit.sh` only (R8). |
| Review | `code-reviewer`, `security-review` for auth, input or secrets. |
| Finishing | `human-checkpoint`, and update `docs/CURRENT_STATE.md` (R13). |
| Tasks and handoffs | `task-board`, `task-contract`, `shared-memory`. |

## Roster

The Orchestrator triages and delegates. Specialists: architect, dba, developer, devops, pm,
qa, researcher, security, tech-lead, tech-writer, tester, ui-designer. In orchestrated
modes, declare the task in `docs/TASK_BOARD.md` and delegate implementation.
