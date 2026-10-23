#!/bin/bash

# Dev-OS Human Checkpoint & Commit Script
# Enforces a human approval token and a Conventional Commits subject, then runs
# `git commit` with DEVOS_COMMIT_APPROVED=true so the Dev-OS pre-commit hook
# (installed by install-hooks.sh) lets it through and runs its secret/env/db/UI/doc scans.
#
# Usage:
#   .agents/scripts/commit.sh                 interactive: approval token, type and message are
#                                             read from the controlling terminal (/dev/tty)
#   DEVOS_HEADLESS_COMMIT=1 .agents/scripts/commit.sh "<type>[(scope)][!]: <subject>"
#                                             CI only (requires CI=true and no agent-shell marker):
#                                             no prompt; the message must be conventional
#
# What it checks: no agent-shell marker is set; something is staged; a human typed 'approve' on
# the terminal (interactive); the commit type/subject are valid. It does NOT run tests or QA itself.
#
# Agent shells can never commit through this script, in either mode. It refuses when any
# agent-shell marker is present (CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, GEMINI_CLI, CODEX_SANDBOX,
# CODEX_SANDBOX_NETWORK_DISABLED, CODEX_THREAD_ID, CURSOR_AGENT, AI_AGENT). Headless mode also
# requires CI=true. The PreToolUse hook is only the first line of defense; these checks hold
# even when the hook's command-text parser is bypassed.

set -u

COMMIT_TYPES='feat|fix|docs|refactor|perf|style|test|chore|build|ci|revert'

echo "======================================"
echo "    Dev-OS Commit & Checkpoint"
echo "======================================"
echo ""
echo "Code must pass QA and receive Human Approval before committing."
echo ""

fail() {
    echo "[ FAIL ] $1" >&2
    [ $# -gt 1 ] && shift && for line in "$@"; do echo "         $line" >&2; done
    exit 1
}

HEADLESS="0"
if [ "${DEVOS_HEADLESS_COMMIT:-}" = "1" ] || [ "${DEVOS_HEADLESS_COMMIT:-}" = "true" ]; then
    HEADLESS="1"
fi

# Keep in sync with AGENT_MARKERS in .agents/hooks/lib/hook-input.js and the pre-commit hook.
AGENT_MARKERS="CLAUDECODE CLAUDE_CODE_ENTRYPOINT GEMINI_CLI CODEX_SANDBOX CODEX_SANDBOX_NETWORK_DISABLED CODEX_THREAD_ID CURSOR_AGENT AI_AGENT"
AGENT_MARKER=""
for marker in $AGENT_MARKERS; do
    if [ -n "${!marker:-}" ]; then
        AGENT_MARKER="$marker"
        break
    fi
done

if [ -n "$AGENT_MARKER" ]; then
    fail "Refusing to commit from an AI agent shell ($AGENT_MARKER is set)." \
        "Commits need a human: stop, present a summary for review, and ask the human to run" \
        ".agents/scripts/commit.sh from their own terminal."
fi

if [ "$HEADLESS" = "1" ] && [ "${CI:-}" != "true" ]; then
    fail "Headless commit refused: DEVOS_HEADLESS_COMMIT is only honoured when CI=true." \
        "Run .agents/scripts/commit.sh interactively from a terminal instead."
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Not inside a git repository."

if git diff --cached --quiet 2>/dev/null; then
    fail "Nothing is staged. Stage the reviewed changes with 'git add <files>' first."
fi

# /dev/tty can exist and be readable while the process has no controlling terminal,
# so test that it can actually be opened.
has_tty() {
    ( : < /dev/tty ) 2>/dev/null
}

# Read from the controlling terminal so piped stdin cannot answer the prompts.
prompt_tty() {
    local prompt="$1"
    local reply=""
    printf '%s' "$prompt" > /dev/tty
    IFS= read -r reply < /dev/tty || fail "No input received from the terminal. Commit aborted."
    printf '%s' "$reply"
}

# 1. Headless (CI) path: message from $1, validated, no prompts.
if [ "$HEADLESS" = "1" ]; then
    echo "[ WARN ] Headless commit authorized via DEVOS_HEADLESS_COMMIT (CI=true, no agent-shell marker)."
    MESSAGE="${1:-}"
    [ -n "$MESSAGE" ] || fail "Headless mode requires the commit message as the first argument." \
        "Usage: DEVOS_HEADLESS_COMMIT=1 .agents/scripts/commit.sh \"feat(scope): subject\""
    if ! printf '%s' "$MESSAGE" | head -n 1 | grep -Eq "^($COMMIT_TYPES)(\([a-z0-9._/-]+\))?!?: .+"; then
        fail "Commit message is not a Conventional Commit: '$MESSAGE'" \
            "Expected: <type>[(scope)][!]: <subject>, type one of: ${COMMIT_TYPES//|/, }"
    fi
    echo ""
    echo "Executing: git commit -m \"$MESSAGE\""
    DEVOS_COMMIT_APPROVED=true git commit -m "$MESSAGE" || fail "git commit failed (see pre-commit output above)."
    echo "[ OK ] Commit successful!"
    exit 0
fi

# 2. Interactive path: requires a real terminal.
if ! has_tty; then
    fail "Human approval requires an interactive terminal." \
        "Cannot open /dev/tty (piped input is blocked by policy)." \
        "Agents: stop and ask the human to run .agents/scripts/commit.sh." \
        "Authorized CI pipelines only: DEVOS_HEADLESS_COMMIT=1 with a message argument."
fi

echo "Staged changes:"
git diff --cached --stat
echo ""

TOKEN=$(prompt_tty "Human Approval Token (type 'approve' to proceed): ")
[ "$TOKEN" = "approve" ] || fail "Invalid human approval token. Commit aborted."
echo "[ OK ] Human approval verified."

COMMIT_TYPE=$(prompt_tty "Commit Type (${COMMIT_TYPES//|/, }): ")
if ! printf '%s' "$COMMIT_TYPE" | grep -Eq "^($COMMIT_TYPES)(\([a-z0-9._/-]+\))?!?$"; then
    fail "Invalid commit type '$COMMIT_TYPE'."
fi

COMMIT_MESSAGE=$(prompt_tty "Commit Message: ")
[ -n "$COMMIT_MESSAGE" ] || fail "Commit message cannot be empty."

echo ""
echo "Executing: git commit -m \"$COMMIT_TYPE: $COMMIT_MESSAGE\""
DEVOS_COMMIT_APPROVED=true git commit -m "$COMMIT_TYPE: $COMMIT_MESSAGE" || fail "git commit failed (see pre-commit output above)."

echo "[ OK ] Commit successful!"
