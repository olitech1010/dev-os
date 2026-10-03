#!/bin/bash

# Dev-OS Runtime Hook: SessionStart
# Enforces Hard Rule #14 (Session-Start Freshness), mounts Orchestrator mode, and writes
# the session state lock (.agents/memory/session.json) that every other hook reads.

set -e

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
else
    ROOT_DIR=$(pwd)
fi
cd "$ROOT_DIR" 2>/dev/null || true

# 1. Session-start freshness fetch (Hard Rule #14)
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git fetch --all --prune >/dev/null 2>&1 || true
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    STATUS_LINE=$(git status -sb 2>/dev/null | head -n 1)
else
    BRANCH="non-git"
    STATUS_LINE="Git repository not detected"
fi

# 2. Resolve the intended mode: manifest default, then preserve an existing session lock.
MODE="interactive"
if [ -f ".agents/manifest.json" ]; then
    MANIFEST_MODE=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' .agents/manifest.json | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')
    if [ -n "$MANIFEST_MODE" ]; then MODE="$MANIFEST_MODE"; fi
fi

SESSION_FILE=".agents/memory/session.json"
STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
if [ -f "$SESSION_FILE" ]; then
    EXISTING_MODE=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' "$SESSION_FILE" | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')
    EXISTING_START=$(grep -o '"startedAt"[[:space:]]*:[[:space:]]*"[^"]*"' "$SESSION_FILE" | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')
    if [ -n "$EXISTING_MODE" ] && [ "$DEVOS_FORCE_MODE" != "1" ]; then MODE="$EXISTING_MODE"; fi
    if [ -n "$EXISTING_START" ]; then STARTED_AT="$EXISTING_START"; fi
fi

# 3. Delegation is required in orchestrated modes, or when explicitly enforced.
DELEGATION="false"
if [ "$MODE" = "auto" ] || [ "$MODE" = "guided" ]; then DELEGATION="true"; fi
if [ "$DEVOS_ENFORCE_ORCHESTRATOR" = "1" ]; then DELEGATION="true"; fi

mkdir -p .agents/memory
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$SESSION_FILE" <<EOF
{
  "schemaVersion": "1.0.0",
  "startedAt": "$STARTED_AT",
  "updatedAt": "$TIMESTAMP",
  "mode": "$MODE",
  "orchestratorLocked": true,
  "delegationRequired": $DELEGATION,
  "switchedBy": "session-start"
}
EOF

echo "=================================================="
echo "  Dev-OS Active — Orchestrator Mode Mounted"
echo "=================================================="
echo "Branch: $BRANCH ($STATUS_LINE)"
echo "Mode Lock: $MODE (delegation required: $DELEGATION)"
echo "Rules in Effect:"
echo "  • Hard Rule #1: Zero Destructive Actions without dry-run plan"
echo "  • Hard Rule #8: Commit Gate Enforced (use .agents/scripts/commit.sh)"
echo "  • Hard Rule #13: Session-End State Obligation (update docs/CURRENT_STATE.md)"
echo "  • Hard Rule #14: Freshness Check verified (git fetch --all --prune)"
echo "  • Orchestrator Persistence: delegate to specialist subagents; switch modes only via 'devos mode'"
echo "=================================================="

exit 0
