#!/bin/bash

# Dev-OS Runtime Hook: UserPromptSubmit
# Re-injects the Orchestrator directive, locked mode, and delegation mandate on EVERY turn.
# This is the mechanical counter to prompt-context decay: instructions loaded once at
# session start fade as context grows, so role and mode are re-asserted each turn.
#
# Interface: Claude Code sends JSON on stdin ({hook_event_name:"UserPromptSubmit", prompt, ...});
# it is drained, not used. Stdout is injected into the model's context. Always exits 0.

# Drain any piped payload without acting on it; a timed read cannot hang on an open pipe.
# Plugin mode (DEVOS_PLUGIN_MODE=1): stand down outside Dev-OS projects. See lib/common.sh.
_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
fi

if [ ! -t 0 ]; then IFS= read -r -d '' -t 2 _DISCARD || true; fi
# lib/common.sh absent (a partial install): keep printing plain text, which is what
# Claude Code and Codex read anyway.
if ! command -v devos_say >/dev/null 2>&1; then
    devos_say() { printf '%s\n' "$1"; }
    devos_flush_context() { :; }
    # devos_superpowers_present calls this; without it the hook printed a
    # "command not found" line and then fell back to plain text on every harness.
    devos_hook_format() { printf 'claude\n'; }
fi


if [ -n "$CLAUDE_PROJECT_DIR" ] && [ -d "$CLAUDE_PROJECT_DIR" ]; then
    cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || true
fi

SESSION_FILE=".agents/memory/session.json"
MODE="interactive"
LOCKED="true"
DELEGATION="false"

if [ -f "$SESSION_FILE" ]; then
    PARSED_MODE=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' "$SESSION_FILE" | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')
    PARSED_LOCK=$(grep -o '"orchestratorLocked"[[:space:]]*:[[:space:]]*\(true\|false\)' "$SESSION_FILE" | head -n1 | grep -o 'true\|false')
    PARSED_DELEG=$(grep -o '"delegationRequired"[[:space:]]*:[[:space:]]*\(true\|false\)' "$SESSION_FILE" | head -n1 | grep -o 'true\|false')
    if [ -n "$PARSED_MODE" ]; then MODE="$PARSED_MODE"; fi
    if [ -n "$PARSED_LOCK" ]; then LOCKED="$PARSED_LOCK"; fi
    if [ -n "$PARSED_DELEG" ]; then DELEGATION="$PARSED_DELEG"; fi
fi

devos_say "=================================================="
devos_say "  Dev-OS Orchestrator Directive (re-injected each turn)"
devos_say "=================================================="
if [ "$LOCKED" = "true" ]; then
    devos_say "Role: ORCHESTRATOR (locked). You do NOT author production code directly."
    devos_say "      Triage the request, declare the task in docs/TASK_BOARD.md, and delegate"
    devos_say "      implementation to the assigned specialist subagent."
else
    devos_say "Role: Orchestrator (unlocked). Specialist delegation is encouraged."
fi
devos_say "Mode: $MODE (locked — change only with 'devos mode <interactive|guided|auto|audit>')."
if [ "$DELEGATION" = "true" ]; then
    devos_say "Delegation: REQUIRED. Solo production-code writes are blocked until an active"
    devos_say "            [ IN_PROGRESS ] task with an Assignee exists in docs/TASK_BOARD.md."
    devos_say "            Intentional solo work requires DEVOS_SOLO_APPROVED=true."
fi
devos_say "Commit: raw 'git commit' is blocked. Use .agents/scripts/commit.sh."
devos_say "=================================================="

devos_flush_context ""
exit 0
