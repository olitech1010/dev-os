---
name: commit
description: Stage changes and commit through the Dev-OS commit gate (the human approves)
agent: developer
triage_level: TRIVIAL
workflow: direct
argument-hint: "[files or scope to stage]"
---

Prepare a commit and route it through the human approval gate.

1. Run `git status` to show current changes
2. Stage the relevant files based on: $ARGUMENTS
3. Show `git diff --cached --stat` and propose a Conventional Commit message (`<type>[(scope)]: <subject>`)
4. Check the policy with `devos commit-policy` (or `commitPolicy` in `.agents/manifest.json`):
   - `human` (default): ask the human to run `.agents/scripts/commit.sh` from their own terminal; it prompts for the `approve` token, type, and message.
   - `agent`, in Claude Code: run exactly `.agents/scripts/commit.sh --agent "<message>"` from the project root. Claude Code asks the human to approve it. If they reject it, stop and ask what to change.

NEVER run raw `git commit`, set `DEVOS_COMMIT_APPROVED`/`DEVOS_AGENT_COMMIT`, or run commit.sh any other way (`bash commit.sh`, `./`, an absolute path). Those are blocked, and they would skip the human's approval.
