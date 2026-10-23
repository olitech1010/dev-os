---
name: git-commit
description: 'Prepare a conventional commit (type, scope, message) from the staged diff and hand it to the Dev-OS commit gate (.agents/scripts/commit.sh). Use when the user asks to commit changes, create a git commit, or mentions "/commit". Supports: (1) Auto-detecting type and scope from changes, (2) Generating conventional commit messages from diff, (3) Optional type/scope/description overrides, (4) Intelligent file staging for logical grouping. Never runs raw git commit.'
license: MIT
allowed-tools: Bash
---

# Git Commit with Conventional Commits

## Overview

Create standardized, semantic git commits using the Conventional Commits specification. Analyze the actual diff to determine appropriate type, scope, and message.

## Conventional Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `style`    | Formatting/style (no logic)    |
| `refactor` | Code refactor (no feature/fix) |
| `perf`     | Performance improvement        |
| `test`     | Add/update tests               |
| `build`    | Build system/dependencies      |
| `ci`       | CI/config changes              |
| `chore`    | Maintenance/misc               |
| `revert`   | Revert commit                  |

## Breaking Changes

```
# Exclamation mark after type/scope
feat!: remove deprecated endpoint

# BREAKING CHANGE footer
feat: allow config to extend other configs

BREAKING CHANGE: `extends` key behavior changed
```

## Workflow

### 1. Analyze Diff

```bash
# If files are staged, use staged diff
git diff --staged

# If nothing staged, use working tree diff
git diff

# Also check status
git status --porcelain
```

### 2. Stage Files (if needed)

If nothing is staged or you want to group changes differently:

```bash
# Stage specific files
git add path/to/file1 path/to/file2

# Stage by pattern
git add *.test.*
git add src/components/*

# Interactive staging
git add -p
```

**Never commit secrets** (.env, credentials.json, private keys).

### 3. Generate Commit Message

Analyze the diff to determine:

- **Type**: What kind of change is this?
- **Scope**: What area/module is affected?
- **Description**: One-line summary of what changed (present tense, imperative mood, <72 chars)

### 4. Commit Through the Gate (Human Approval Required)

Raw `git commit` is forbidden in Dev-OS (Hard Rule "Mechanical Commit Gate" in `.agents/AGENTS.md`) and is blocked by hooks. Agents never commit on their own (Staged Review):

1. Present the staged file list, the diff summary, and your proposed message (`<type>[scope]: <description>`) to the human.
2. Wait for QA approval and an explicit human go-ahead.
3. The human runs the gate script, or you run it only when the human asks you to and is present at the terminal:

```bash
./.agents/scripts/commit.sh
```

The script reads from the controlling terminal: it asks for the approval token (`approve`), the commit type, and the description, then commits. It refuses piped input. Headless use (`DEVOS_HEADLESS_COMMIT=1 ./.agents/scripts/commit.sh "<type>: <description>"`) is reserved for CI pipelines the human has explicitly authorized; agents must not set it themselves.

If the message needs a body or footer, hand the full text to the human and let them amend it at the terminal; do not bypass the gate to add one.

## Best Practices

- One logical change per commit
- Present tense: "add" not "added"
- Imperative mood: "fix bug" not "fixes bug"
- Reference issues: `Closes #123`, `Refs #456`
- Keep description under 72 characters

## Git Safety Protocol

- NEVER update git config
- NEVER run destructive commands (--force, hard reset) without explicit request
- NEVER skip hooks (--no-verify) unless user asks
- NEVER force push to main/master
- If commit fails due to hooks, fix the issue and run the commit gate again (don't amend)
