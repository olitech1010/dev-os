---
name: commit
description: Stage changes and hand the commit to the human through the Dev-OS commit gate
agent: developer
triage_level: TRIVIAL
workflow: direct
argument-hint: "[files or scope to stage]"
---

Prepare a commit for the human. Agents cannot commit: `.agents/scripts/commit.sh` and the git pre-commit and pre-merge-commit hooks refuse whenever an agent-shell marker (`CLAUDECODE`, `GEMINI_CLI`, `CODEX_*`, `CURSOR_AGENT`, `AI_AGENT`, and similar) is set.

1. Run `git status` to show current changes
2. Stage the relevant files based on: $ARGUMENTS
3. Show `git diff --cached --stat` and propose a Conventional Commit message (`<type>[(scope)]: <subject>`)
4. Ask the human to run `.agents/scripts/commit.sh` from their own terminal; it prompts for the `approve` token, type, and message

NEVER run raw `git commit` or `commit.sh` yourself.
