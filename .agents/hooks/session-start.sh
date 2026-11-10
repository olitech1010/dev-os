#!/bin/bash

# Dev-OS Runtime Hook: SessionStart
# Enforces Hard Rule 14 (Session-Start Freshness), mounts Orchestrator mode, and writes
# the session state lock (.agents/memory/session.json) that every other hook reads.
#
# Interface: Claude Code sends JSON on stdin ({hook_event_name:"SessionStart", source, cwd, ...});
# a TTY or empty stdin is fine. Stdout is injected into the model's context. Always exits 0.
# source "compact" (matcher "compact", fired after auto or manual compaction): no fetch and no new
# session stamp; prints a short orchestrator directive (mode, active task, rules, circuit breaker)
# so the summary-only context keeps its operating rules.
# Env: DEVOS_OFFLINE=1 skips the network fetch; DEVOS_FETCH_TIMEOUT (seconds, default 4)
# bounds how long the fetch may delay session start.

# Drain the payload without hanging (bash 3.2 compatible timed read).
# Plugin mode (DEVOS_PLUGIN_MODE=1): stand down outside Dev-OS projects. See lib/common.sh.
_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
fi

# lib/common.sh absent (a partial install): keep printing plain text, which is what
# Claude Code and Codex read anyway.
if ! command -v devos_say >/dev/null 2>&1; then
    devos_say() { printf '%s\n' "$1"; }
    devos_flush_context() { :; }
    # devos_superpowers_present calls this; without it the hook printed a
    # "command not found" line and then fell back to plain text on every harness.
    devos_hook_format() { printf 'claude\n'; }
fi

HOOK_INPUT=""
if [ ! -t 0 ]; then
    IFS= read -r -d '' -t 2 HOOK_INPUT || true
fi
SESSION_SOURCE=$(printf '%s' "$HOOK_INPUT" | grep -o '"source"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')

if [ -n "$CLAUDE_PROJECT_DIR" ] && [ -d "$CLAUDE_PROJECT_DIR" ]; then
    cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || true
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
else
    ROOT_DIR=$(pwd)
fi
cd "$ROOT_DIR" 2>/dev/null || true

# 1. Session-start freshness fetch (Hard Rule 14), bounded so a slow or credential-prompting
# remote cannot stall session start.
FETCH_NOTE="fetched"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    # Session stamp for stop.sh: files modified after this point count as "changed this session".
    # Kept inside .git/ so it is never tracked. Compaction is not a new session.
    if [ "$SESSION_SOURCE" != "compact" ]; then
        STAMP_PATH=$(git rev-parse --git-path devos-session-stamp 2>/dev/null)
        [ -n "$STAMP_PATH" ] && touch "$STAMP_PATH" 2>/dev/null
    fi

    if [ "$SESSION_SOURCE" = "compact" ]; then
        FETCH_NOTE="skipped (compact)"
    elif [ "$DEVOS_OFFLINE" = "1" ]; then
        FETCH_NOTE="skipped (offline)"
    elif [ -z "$(git remote 2>/dev/null)" ]; then
        FETCH_NOTE="no remote"
    else
        GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes -o ConnectTimeout=3}" \
            git fetch --all --prune >/dev/null 2>&1 &
        FETCH_PID=$!
        FETCH_TIMEOUT="${DEVOS_FETCH_TIMEOUT:-4}"
        case "$FETCH_TIMEOUT" in ''|*[!0-9]*) FETCH_TIMEOUT=4 ;; esac
        LIMIT=$((FETCH_TIMEOUT * 10))
        WAITED=0
        while kill -0 "$FETCH_PID" 2>/dev/null && [ "$WAITED" -lt "$LIMIT" ]; do
            sleep 0.1
            WAITED=$((WAITED + 1))
        done
        if kill -0 "$FETCH_PID" 2>/dev/null; then
            # Leave it running in the background (killing a fetch mid-write can leave stale locks).
            FETCH_NOTE="still running in background (status may be stale)"
        elif ! wait "$FETCH_PID" 2>/dev/null; then
            FETCH_NOTE="failed (status may be stale)"
        fi
    fi
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    STATUS_LINE=$(git status -sb 2>/dev/null | head -n 1)
else
    BRANCH="non-git"
    STATUS_LINE="Git repository not detected"
    FETCH_NOTE="n/a"
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

mkdir -p .agents/memory 2>/dev/null
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

# Bootstrap skill (using-devos): injected in full at session start and after compaction so the
# model checks for a skill before acting, the same way Superpowers loads its using-superpowers
# skill. Every other skill loads on demand from its description. When Superpowers is enabled it
# already carries the skill-check rule, so only a short Dev-OS delta is printed (the model is
# not told the same rule twice). DEVOS_SUPERPOWERS=on|off overrides detection (tests).
devos_superpowers_present() {
    case "$DEVOS_SUPERPOWERS" in on) return 0 ;; off) return 1 ;; esac
    # Superpowers is a Claude Code plugin. Its enabledPlugins entry says nothing about any
    # other harness, so on Codex, Cursor, Antigravity or OpenCode it is not loaded and Dev-OS
    # must inject its own bootstrap instead of yielding to something that is not there.
    [ "$(devos_hook_format)" = "claude" ] || return 1
    for _f in "$HOME/.claude/settings.json" ".claude/settings.json" ".claude/settings.local.json"; do
        [ -f "$_f" ] && grep -qE '"superpowers@[^"]*"[[:space:]]*:[[:space:]]*true' "$_f" 2>/dev/null && return 0
    done
    return 1
}

devos_bootstrap() {
    _skill=".agents/skills/using-devos/SKILL.md"
    [ -f "$_skill" ] || return 0
    if devos_superpowers_present; then
        devos_say "Dev-OS skills (Superpowers is enabled, so its skill-check rule applies to these too):"
        devos_say "  features: brainstorming then writing-plans/spec-driven; bugs: qa; UI: anti-ai-ui; commits: git-ops;"
        devos_say "  review: code-reviewer/security-review; finishing: human-checkpoint. Hard Rules in .agents/AGENTS.md outrank skills."
        return 0
    fi
    devos_say "--- using-devos (bootstrap skill, loaded automatically) ---"
    devos_say "$(awk '/^---[[:space:]]*$/ && n < 2 { n++; next } n >= 2' "$_skill")"
    devos_say "--- end using-devos ---"
}

if [ "$SESSION_SOURCE" = "compact" ]; then
    # First top-level task line and its Assignee under '### [ IN_PROGRESS ]'.
    ACTIVE_TASK="none declared"
    if [ -f "docs/TASK_BOARD.md" ]; then
        TASK_LINES=$(awk '/^###[[:space:]]*\[[[:space:]]*IN_PROGRESS[[:space:]]*\]/{f=1;next} /^###[[:space:]]/{f=0} f' docs/TASK_BOARD.md)
        T_LINE=$(printf '%s\n' "$TASK_LINES" | grep -E '^[-*][[:space:]]' | head -n 1 | sed -e 's/^[-*][[:space:]]*//' -e 's/\*//g' -e 's/`//g' | cut -c 1-160)
        T_ASSIGNEE=$(printf '%s\n' "$TASK_LINES" | grep -E 'Assignee:' | head -n 1 | sed -e 's/.*Assignee:[*[:space:]]*//' -e 's/\*//g' | cut -c 1-60)
        if [ -n "$T_LINE" ]; then
            ACTIVE_TASK="$T_LINE"
            [ -n "$T_ASSIGNEE" ] && ACTIVE_TASK="$ACTIVE_TASK (Assignee: $T_ASSIGNEE)"
        fi
    fi
    devos_say "Dev-OS context restored after compaction (orchestrator directive):"
    devos_say "- Mode: $MODE (delegation required: $DELEGATION). Change modes only via 'devos mode <mode>'."
    devos_say "- Active task (docs/TASK_BOARD.md): $ACTIVE_TASK"
    devos_say "- Hard Rules: re-read the digest in CLAUDE.md / AGENTS.md and '## Hard Rules' in .agents/AGENTS.md before acting."
    devos_say "  Key: no destructive actions without an approved dry-run plan; never commit (humans use .agents/scripts/commit.sh);"
    devos_say "  update docs/CURRENT_STATE.md before finishing."
    devos_say "- Circuit breaker: after 3 failed fix iterations on the same task, HALT, summarize each attempt and the failing"
    devos_say "  gate output, request one Tech Lead arbitration, then escalate to the human ('Circuit Breaker' in .agents/AGENTS.md)."
    devos_say "- Delegate implementation to specialist subagents; each writes a handoff note in .agents/memory/handoffs/."
    devos_bootstrap
    devos_flush_context ""
    exit 0
fi

devos_say "=================================================="
devos_say "  Dev-OS Active — Orchestrator Mode Mounted"
devos_say "=================================================="
devos_say "Branch: $BRANCH ($STATUS_LINE) [fetch: $FETCH_NOTE]"
devos_say "Mode Lock: $MODE (delegation required: $DELEGATION)"
devos_say "Rules in Effect:"
devos_say "  - Hard Rule 1: Zero Destructive Actions without dry-run plan"
devos_say "  - Hard Rule 8: Commit Gate Enforced (humans commit via .agents/scripts/commit.sh)"
devos_say "  - Hard Rule 13: Session-End State Obligation (update docs/CURRENT_STATE.md)"
devos_say "  - Hard Rule 14: Freshness Check (git fetch --all --prune)"
devos_say "  - Orchestrator Persistence: delegate to specialist subagents; switch modes only via 'devos mode'"
devos_say "=================================================="
devos_bootstrap
devos_flush_context ""

exit 0
