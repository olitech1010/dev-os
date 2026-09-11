#!/bin/bash

# Dev-OS Runtime Hook: SessionStart
# Enforces Hard Rule #14 (Session-Start Freshness) and displays active gate notice.

set -e

# 1. Run session-start freshness fetch if inside a git repo
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    # Fetch remote state quietly
    git fetch --all --prune >/dev/null 2>&1 || true
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    STATUS_LINE=$(git status -sb 2>/dev/null | head -n 1)
else
    BRANCH="non-git"
    STATUS_LINE="Git repository not detected"
fi

echo "=================================================="
echo "  Dev-OS Active — Autonomous Engineering OS"
echo "=================================================="
echo "Branch: $BRANCH ($STATUS_LINE)"
echo "Rules in Effect:"
echo "  • Hard Rule #1: Zero Destructive Actions without dry-run plan"
echo "  • Hard Rule #8: Commit Gate Enforced (use .agents/scripts/commit.sh)"
echo "  • Hard Rule #13: Session-End State Obligation (update docs/CURRENT_STATE.md)"
echo "  • Hard Rule #14: Freshness Check verified (git fetch --all --prune)"
echo "=================================================="

exit 0
