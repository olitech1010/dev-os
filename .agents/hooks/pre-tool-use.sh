#!/bin/bash

# Dev-OS Runtime Hook: PreToolUse
# Enforces Hard Rule #1 (Zero Destructive Actions) and Hard Rule #8 (Commit Gate).

INPUT_CMD="$*"
if [ -z "$INPUT_CMD" ] && [ ! -t 0 ]; then
    INPUT_CMD=$(cat)
fi

if [ -z "$INPUT_CMD" ]; then
    exit 0
fi

# 1. Block destructive file-system and git commands
if echo "$INPUT_CMD" | grep -Eq 'rm -rf\s+[/~*]|rm -rf\s+\.\./|git reset --hard\s+origin|DROP\s+(TABLE|DATABASE)|TRUNCATE\s+TABLE'; then
    echo ""
    echo "[ FAIL ] Dev-OS Policy Violation (Hard Rule #1: Zero Destructive Actions)"
    echo "         Destructive command blocked: $INPUT_CMD"
    echo "         You MUST formulate and present a dry-run plan to the human before executing."
    echo ""
    exit 1
fi

# 2. Intercept raw git commit attempts without approval token
if echo "$INPUT_CMD" | grep -Eq '\bgit\s+commit\b' && [ "$DEVOS_COMMIT_APPROVED" != "true" ]; then
    # Check if this is calling commit.sh
    if ! echo "$INPUT_CMD" | grep -q 'commit\.sh'; then
        echo ""
        echo "[ FAIL ] Dev-OS Policy Violation (Hard Rule #8: Mechanical Commit Gate)"
        echo "         Raw 'git commit' is strictly forbidden."
        echo "         You must route all commits through: .agents/scripts/commit.sh"
        echo ""
        exit 1
    fi
fi

exit 0
