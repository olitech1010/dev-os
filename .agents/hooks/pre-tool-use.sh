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
    if [ -f "bin/devos.js" ]; then
        node bin/devos.js telemetry log --type HOOK_VIOLATION --rule "$RULE" --detail "$DETAIL" --quiet 2>/dev/null && return 0
    elif command -v devos >/dev/null 2>&1; then
        devos telemetry log --type HOOK_VIOLATION --rule "$RULE" --detail "$DETAIL" --quiet 2>/dev/null && return 0
    fi

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

# A board only counts as having an active task if the [ IN_PROGRESS ] section body
# declares one with an Assignee. The section header or the DAG legend is not proof.
has_active_task() {
    [ -f "docs/TASK_BOARD.md" ] || return 1
    ACTIVE_BLOCK=$(awk '/^###[[:space:]]*\[[[:space:]]*IN_PROGRESS[[:space:]]*\]/{f=1;next} /^###[[:space:]]/{f=0} f' "docs/TASK_BOARD.md")
    echo "$ACTIVE_BLOCK" | grep -Eq 'Assignee:'
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
    if ! has_active_task; then
        echo ""
        echo "[ FAIL ] Dev-OS Policy Violation (Task Board State Gate)"
        echo "         No active task marked [ IN_PROGRESS ] in 'docs/TASK_BOARD.md'."
        echo "         Select or start a task first: devos task start <id>"
        echo ""
        LOG_TELEMETRY "TASK_BOARD_GATE" "$INPUT_CMD"
        exit 1
    fi
fi

# 5. Orchestration Gate — Mechanical Routing Enforcement (MREE)
# Blocks solo production-code authoring when orchestrator delegation is enforced and no
# active task with an assignee is declared. Escape hatch: DEVOS_SOLO_APPROVED=true.
if echo "$INPUT_CMD" | grep -Eq '\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|php|vue|svelte|sql)\b'; then
    if ! echo "$INPUT_CMD" | grep -Eq '\.agents/|docs/|/scripts/|scripts/|/tests/|tests/|/hooks/|/commands/|/agents/|/skills/|node_modules/|\.test\.|\.spec\.|\.config\.|\.d\.ts|\.md\b'; then
        ORCH_ENFORCED="0"
        if [ "$DEVOS_ENFORCE_ORCHESTRATOR" = "1" ]; then ORCH_ENFORCED="1"; fi
        if [ -f ".agents/memory/session.json" ] && grep -Eq '"delegationRequired"[[:space:]]*:[[:space:]]*true' .agents/memory/session.json; then
            ORCH_ENFORCED="1"
        fi

        if [ "$ORCH_ENFORCED" = "1" ] && [ "$DEVOS_SOLO_APPROVED" != "true" ]; then
            if ! has_active_task; then
                echo ""
                echo "[ FAIL ] Dev-OS Policy Violation (Orchestration Gate / MREE)"
                echo "         Orchestrator delegation is enforced but no active task with an assignee is declared."
                echo "         Remediation:"
                echo "           1. Declare the task under [ IN_PROGRESS ] with an Assignee in docs/TASK_BOARD.md."
                echo "           2. Delegate implementation to the assigned specialist subagent."
                echo "           3. To intentionally work solo, export DEVOS_SOLO_APPROVED=true."
                echo ""
                LOG_TELEMETRY "ORCHESTRATION_GATE" "$INPUT_CMD"
                exit 1
            fi
        fi
    fi
fi

exit 0
