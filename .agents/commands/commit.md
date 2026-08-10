---
name: commit
description: Stage and commit changes through the Dev-OS commit gate
agent: developer
triage_level: TRIVIAL
workflow: direct
---

Prepare and execute a commit through `.agents/scripts/commit.sh`.

1. Run `git status` to show current changes
2. Stage the relevant files based on: $ARGUMENTS
3. Execute `.agents/scripts/commit.sh` for human-approved conventional commit

NEVER run raw `git commit`. Always use `commit.sh`.
