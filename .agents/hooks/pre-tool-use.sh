#!/bin/bash

# Dev-OS Runtime Hook: PreToolUse
# Enforces Hard Rule #1 (Zero Destructive Actions), Hard Rule #8 (Commit Gate),
# and the Mandatory Design Gate (DESIGN.md at project root must precede frontend UI authoring).

INPUT_CMD="$*"
if [ -z "$INPUT_CMD" ] && [ ! -t 0 ]; then
    INPUT_CMD=$(cat)
fi

if [ -z "$INPUT_CMD" ]; then
    exit 0
fi

LOG_TELEMETRY() {
    RULE="$1"
    DETAIL="$2"
    MANIFEST=".agents/manifest.json"
    TELEMETRY_STATUS="on"
    if [ -f "$MANIFEST" ]; then
        if grep -q '"telemetry":\s*"off"' "$MANIFEST"; then
            TELEMETRY_STATUS="off"
        fi
    fi

    if [ "$TELEMETRY_STATUS" != "off" ]; then
        mkdir -p .agents/telemetry
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")
        CLEAN_DETAIL=$(echo "$DETAIL" | tr '"\n\r' '   ' | cut -c 1-200)
        echo "{\"timestamp\":\"$TIMESTAMP\",\"eventType\":\"HOOK_VIOLATION\",\"rule\":\"$RULE\",\"detail\":\"$CLEAN_DETAIL\"}" >> .agents/telemetry/events.jsonl
    fi
}

# 1. Block destructive file-system and git commands (Hard Rule #1)
if echo "$INPUT_CMD" | grep -Eq 'rm -rf\s+[/~*]|rm -rf\s+\.\./|git reset --hard\s+origin|DROP\s+(TABLE|DATABASE)|TRUNCATE\s+TABLE'; then
    echo ""
    echo "[ FAIL ] Dev-OS Policy Violation (Hard Rule #1: Zero Destructive Actions)"
    echo "         Destructive command blocked: $INPUT_CMD"
    echo "         You MUST formulate and present a dry-run plan to the human before executing."
    echo ""
    LOG_TELEMETRY "RULE_1_ZERO_DESTRUCTIVE" "$INPUT_CMD"
    exit 1
fi

# 2. Intercept raw git commit attempts without approval token (Hard Rule #8)
if echo "$INPUT_CMD" | grep -Eq '\bgit\s+commit\b' && [ "$DEVOS_COMMIT_APPROVED" != "true" ]; then
    # Check if this is calling commit.sh
    if ! echo "$INPUT_CMD" | grep -q 'commit\.sh'; then
        echo ""
        echo "[ FAIL ] Dev-OS Policy Violation (Hard Rule #8: Mechanical Commit Gate)"
        echo "         Raw 'git commit' is strictly forbidden."
        echo "         You must route all commits through: .agents/scripts/commit.sh"
        echo ""
        LOG_TELEMETRY "RULE_8_COMMIT_GATE" "$INPUT_CMD"
        exit 1
    fi
fi

# 3. Mandatory Design Gate: Block frontend UI creation if DESIGN.md is missing
# Checks if command creates/edits .tsx, .jsx, .vue, .svelte, .html, or .css files
if echo "$INPUT_CMD" | grep -Eq '\.(tsx|jsx|vue|svelte|html|css)\b'; then
    # Allow modifications to DESIGN.md itself, documentation, tests, and config files
    if ! echo "$INPUT_CMD" | grep -Eq 'DESIGN\.md|docs/|\.agents/|package\.json|tailwind\.config'; then
        if [ ! -f "DESIGN.md" ] && [ ! -f "docs/DESIGN.md" ]; then
            echo ""
            echo "[ FAIL ] Dev-OS Policy Violation (Mandatory Design Gate)"
            echo "         Cannot create or modify frontend code without an established 'DESIGN.md' at project root."
            echo "         Remediation:"
            echo "           1. Invoke the UI Designer agent with skill 'ui-ux-pro-max'."
            echo "           2. Extract design tokens and archetype matching this project."
            echo "           3. Author 'DESIGN.md' at project root and obtain QA approval before writing UI components."
            echo ""
            LOG_TELEMETRY "MANDATORY_DESIGN_GATE" "$INPUT_CMD"
            exit 1
        fi
    fi
fi

# 4. Task Board Active Task Gate (Optional strict mode when DEVOS_ENFORCE_TASK_BOARD=1)
if [ "$DEVOS_ENFORCE_TASK_BOARD" = "1" ] && [ -f "docs/TASK_BOARD.md" ]; then
    if ! grep -q '\[IN_PROGRESS\]' "docs/TASK_BOARD.md"; then
        echo ""
        echo "[ FAIL ] Dev-OS Policy Violation (Task Board State Gate)"
        echo "         No active task marked [IN_PROGRESS] in 'docs/TASK_BOARD.md'."
        echo "         Select or start a task first: devos task start <id>"
        echo ""
        LOG_TELEMETRY "TASK_BOARD_GATE" "$INPUT_CMD"
        exit 1
    fi
fi

exit 0
