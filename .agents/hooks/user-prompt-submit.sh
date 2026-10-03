#!/bin/bash

# Dev-OS Runtime Hook: UserPromptSubmit
# Re-injects the Orchestrator directive, locked mode, and delegation mandate on EVERY turn.
# This is the mechanical counter to prompt-context decay: instructions loaded once at
# session start fade as context grows, so role and mode are re-asserted each turn.

# Consume any piped payload without acting on it.
if [ ! -t 0 ]; then cat >/dev/null 2>&1 || true; fi

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

echo "=================================================="
echo "  Dev-OS Orchestrator Directive (re-injected each turn)"
echo "=================================================="
if [ "$LOCKED" = "true" ]; then
    echo "Role: ORCHESTRATOR (locked). You do NOT author production code directly."
    echo "      Triage the request, declare the task in docs/TASK_BOARD.md, and delegate"
    echo "      implementation to the assigned specialist subagent."
else
    echo "Role: Orchestrator (unlocked). Specialist delegation is encouraged."
fi
echo "Mode: $MODE (locked — change only with 'devos mode <interactive|guided|auto|audit>')."
if [ "$DELEGATION" = "true" ]; then
    echo "Delegation: REQUIRED. Solo production-code writes are blocked until an active"
    echo "            [ IN_PROGRESS ] task with an Assignee exists in docs/TASK_BOARD.md."
    echo "            Intentional solo work requires DEVOS_SOLO_APPROVED=true."
fi
echo "Commit: raw 'git commit' is blocked. Use .agents/scripts/commit.sh."
echo "=================================================="

exit 0
