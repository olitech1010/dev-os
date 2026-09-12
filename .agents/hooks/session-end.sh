#!/bin/bash

# Dev-OS Runtime Hook: SessionEnd
# Enforces Hard Rule #13 (Session-End State Obligation: update docs/CURRENT_STATE.md).

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    exit 0
fi

# Check for modified tracked files or staged changes
MODIFIED_COUNT=$(git status --porcelain 2>/dev/null | grep -v '^\?\?' | wc -l | tr -d ' ')

if [ "$MODIFIED_COUNT" -gt 0 ]; then
    # Check if docs/CURRENT_STATE.md is among the modified or committed files in this session
    RECENT_CHANGES=$(git status --porcelain docs/CURRENT_STATE.md 2>/dev/null || true)
    LAST_COMMIT_TOUCHED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E 'docs/CURRENT_STATE\.md' || true)

    if [ -z "$RECENT_CHANGES" ] && [ -z "$LAST_COMMIT_TOUCHED" ]; then
        echo ""
        echo "[ WARN ] Dev-OS Hard Rule #13 Reminder (Session-End State Obligation):"
        echo "         You have modified code, dependencies, or configuration in this session,"
        echo "         but docs/CURRENT_STATE.md has not been updated."
        echo "         Please update docs/CURRENT_STATE.md with current status and next steps."
        echo ""
    fi
fi

exit 0
