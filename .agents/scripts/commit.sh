#!/bin/bash

# Dev-OS Human Checkpoint & Commit Script
# Enforces a human approval token and a Conventional Commits subject, then runs
# `git commit` with DEVOS_COMMIT_APPROVED=true so the Dev-OS pre-commit hook
# (installed by install-hooks.sh) lets it through and runs its secret/env/db/UI/doc scans.
#
# Usage:
#   .agents/scripts/commit.sh                 interactive: approval token, type and message are
#                                             read from the controlling terminal (/dev/tty)
#   .agents/scripts/commit.sh --agent "<type>[(scope)][!]: <subject>[\n\n<body>]"
#                                             Claude Code agent, only with commitPolicy "agent":
#                                             the human approves through the Claude Code permission
#                                             prompt (ask rule Bash(.agents/scripts/commit.sh *))
#   DEVOS_HEADLESS_COMMIT=1 .agents/scripts/commit.sh "<type>[(scope)][!]: <subject>"
#                                             CI only (requires CI=true and no agent-shell marker):
#                                             no prompt; the message must be conventional
#
# What it checks: something is staged; a human approved (typed 'approve' on the terminal, or
# answered the Claude Code permission prompt in --agent mode); the commit message is valid.
# It does NOT run tests or QA itself.
#
# Agent shells (CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, GEMINI_CLI, CODEX_SANDBOX,
# CODEX_SANDBOX_NETWORK_DISABLED, CODEX_THREAD_ID, CURSOR_AGENT, AI_AGENT) are refused unless
# ALL of these hold (the --agent path):
#   - .agents/manifest.json has "commitPolicy": "agent" (set by the human: devos commit-policy agent)
#   - the shell is Claude Code (CLAUDECODE set, no other harness marker): only Claude Code has a
#     permission prompt that an agent cannot answer and that holds in every permission mode
#   - .claude/settings.json lists Bash(.agents/scripts/commit.sh *) under permissions.ask
#   - the script runs as ".agents/scripts/commit.sh" from the repository root, so the ask rule
#     matched the command (the PreToolUse hook blocks every other spelling)
# Headless mode also requires CI=true. The PreToolUse hook is only the first line of defense;
# these checks hold even when the hook's command-text parser is bypassed.

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

AGENT_MODE="0"
if [ "${1:-}" = "--agent" ]; then
    AGENT_MODE="1"
    shift
fi

# Keep in sync with AGENT_MARKERS in .agents/hooks/lib/hook-input.js and the pre-commit hook.
AGENT_MARKERS="CLAUDECODE CLAUDE_CODE_ENTRYPOINT GEMINI_CLI CODEX_SANDBOX CODEX_SANDBOX_NETWORK_DISABLED CODEX_THREAD_ID CURSOR_AGENT AI_AGENT"
# Markers of harnesses other than Claude Code: these never get the --agent path.
OTHER_HARNESS_MARKERS="GEMINI_CLI CODEX_SANDBOX CODEX_SANDBOX_NETWORK_DISABLED CODEX_THREAD_ID CURSOR_AGENT"
AGENT_MARKER=""
for marker in $AGENT_MARKERS; do
    if [ -n "${!marker:-}" ]; then
        AGENT_MARKER="$marker"
        break
    fi
done

ASK_RULE='Bash(.agents/scripts/commit.sh *)'

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Not inside a git repository."
REPO_ROOT=$(cd "$(git rev-parse --show-toplevel)" && pwd -P)

agent_policy_enabled() {
    [ -f "$REPO_ROOT/.agents/manifest.json" ] \
        && grep -Eq '"commitPolicy"[[:space:]]*:[[:space:]]*"agent"' "$REPO_ROOT/.agents/manifest.json"
}

ask_rule_wired() {
    command -v node >/dev/null 2>&1 || return 1
    node -e '
        const fs = require("fs");
        try {
            const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
            const ask = s && s.permissions && Array.isArray(s.permissions.ask) ? s.permissions.ask : [];
            process.exit(ask.includes(process.argv[2]) ? 0 : 1);
        } catch (e) { process.exit(1); }
    ' "$REPO_ROOT/.claude/settings.json" "$ASK_RULE" 2>/dev/null
}

if [ "$AGENT_MODE" = "1" ]; then
    [ -n "$AGENT_MARKER" ] || fail "--agent is only for Claude Code agent sessions." \
        "Humans: run .agents/scripts/commit.sh with no arguments."
    agent_policy_enabled || fail "Agent commits are disabled (commitPolicy is not \"agent\")." \
        "Present your changes for human review and ask the human to commit." \
        "To let the agent commit with per-commit approval in the Claude Code prompt: devos commit-policy agent"
    for marker in $OTHER_HARNESS_MARKERS; do
        [ -z "${!marker:-}" ] || fail "Agent commits are only supported in Claude Code ($marker is set)." \
            "Ask the human to run .agents/scripts/commit.sh from their own terminal."
    done
    [ -n "${CLAUDECODE:-}" ] || fail "Agent commits need a Claude Code shell (CLAUDECODE is not set)." \
        "Ask the human to run .agents/scripts/commit.sh from their own terminal."
    ask_rule_wired || fail "The Claude Code approval prompt is not wired." \
        "$ASK_RULE must be listed under permissions.ask in .claude/settings.json (run: devos update)."
    [ "$0" = ".agents/scripts/commit.sh" ] && [ "$(pwd -P)" = "$REPO_ROOT" ] \
        || fail "Run exactly: .agents/scripts/commit.sh --agent \"<message>\" from the repository root." \
            "Any other spelling skips the Claude Code approval prompt."
    [ "$HEADLESS" = "0" ] || fail "DEVOS_HEADLESS_COMMIT cannot be combined with --agent."
elif [ -n "$AGENT_MARKER" ]; then
    if agent_policy_enabled && [ -n "${CLAUDECODE:-}" ]; then
        fail "Agent sessions commit with: .agents/scripts/commit.sh --agent \"<type>(scope): <subject>\"" \
            "Claude Code then asks the human to approve the commit."
    fi
    fail "Refusing to commit from an AI agent shell ($AGENT_MARKER is set)." \
        "Commits need a human: stop, present a summary for review, and ask the human to run" \
        ".agents/scripts/commit.sh from their own terminal." \
        "(In Claude Code, agent commits with per-commit approval: devos commit-policy agent)"
fi

if [ "$HEADLESS" = "1" ] && [ "${CI:-}" != "true" ]; then
    fail "Headless commit refused: DEVOS_HEADLESS_COMMIT is only honoured when CI=true." \
        "Run .agents/scripts/commit.sh interactively from a terminal instead."
fi

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

# 1. Agent path (Claude Code, commitPolicy "agent"): the human approved this exact command in
#    the Claude Code permission prompt before it ran. The message is the first argument.
if [ "$AGENT_MODE" = "1" ]; then
    MESSAGE="${1:-}"
    [ -n "$MESSAGE" ] || fail "--agent requires the commit message as the next argument." \
        "Usage: .agents/scripts/commit.sh --agent \"feat(scope): subject\""
    if ! printf '%s\n' "$MESSAGE" | head -n 1 | grep -Eq "^($COMMIT_TYPES)(\([a-z0-9._/-]+\))?!?: .+"; then
        fail "Commit message is not a Conventional Commit: '$(printf '%s\n' "$MESSAGE" | head -n 1)'" \
            "Expected: <type>[(scope)][!]: <subject>, type one of: ${COMMIT_TYPES//|/, }"
    fi
    echo "[ OK ] Agent commit approved through the Claude Code permission prompt (commitPolicy: agent)."
    echo "Staged changes:"
    git diff --cached --stat
    echo ""
    printf '%s\n' "$MESSAGE" | DEVOS_COMMIT_APPROVED=true DEVOS_AGENT_COMMIT=1 git commit -F - \
        || fail "git commit failed (see pre-commit output above)."
    echo "[ OK ] Commit successful!"
    exit 0
fi

# 2. Headless (CI) path: message from $1, validated, no prompts.
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

# 3. Interactive path: requires a real terminal.
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
