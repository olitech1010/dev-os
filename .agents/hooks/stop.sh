#!/bin/bash

# Dev-OS Runtime Hook: Stop
# Enforces Hard Rule 13 (Session-End State Obligation) at the turn boundary, where the
# model can still act on it: if tracked code changed in this session and
# docs/CURRENT_STATE.md was not updated, block the stop (exit 2) with a reason on stderr.
#
# Interface:
#   Claude Code:  JSON payload on stdin ({hook_event_name:"Stop", stop_hook_active, cwd, ...}).
#   Manual run:   stop.sh            (no stdin needed; a TTY or empty stdin is treated as {}).
# Exit codes: 0 = allow stop, 2 = keep working (reason on stderr is shown to the model).
# Opt-out: DEVOS_STOP_GATE=off.
#
# "Changed in this session" = modified tracked files (staged or unstaged) outside docs/,
# .agents/memory/ and .agents/telemetry/ that are newer than the session stamp written by
# session-start.sh ($(git rev-parse --git-path devos-session-stamp), i.e. inside .git/).
# Without a stamp every modified file counts.
# "CURRENT_STATE updated" = docs/CURRENT_STATE.md exists and is newer than every changed file.
# Merely having CURRENT_STATE.md in the diff is not enough: an edit made early in the session
# must not open the gate for code changed after it.

# Plugin mode (DEVOS_PLUGIN_MODE=1): stand down outside Dev-OS projects. See lib/common.sh.
_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
fi

if [ "$DEVOS_STOP_GATE" = "off" ]; then
    exit 0
fi

# Parsed with a bash timed read + grep instead of node so the hook stays well under 1s.
STOP_HOOK_ACTIVE="false"
HOOK_INPUT=""
if [ ! -t 0 ]; then
    IFS= read -r -d '' -t 2 HOOK_INPUT || true
fi
if printf '%s' "$HOOK_INPUT" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    STOP_HOOK_ACTIVE="true"
fi
ROOT="$CLAUDE_PROJECT_DIR"

# Already continuing because of a stop hook: never block twice (prevents loops).
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
    exit 0
fi

if [ -n "$ROOT" ]; then
    cd "$ROOT" 2>/dev/null || exit 0
fi

TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$TOPLEVEL" 2>/dev/null || exit 0

# Modified tracked files, staged or unstaged. A repo without commits has no HEAD.
if git rev-parse --verify -q HEAD >/dev/null 2>&1; then
    CHANGED=$(git diff --name-only HEAD -- 2>/dev/null)
else
    CHANGED=$( { git diff --name-only --cached -- ; git diff --name-only -- ; } 2>/dev/null | sort -u)
fi
[ -n "$CHANGED" ] || exit 0

STATE_FILE="docs/CURRENT_STATE.md"
STAMP=$(git rev-parse --git-path devos-session-stamp 2>/dev/null)
CODE_CHANGED=""
while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in
        docs/*|.agents/memory/*|.agents/telemetry/*) continue ;;
    esac
    # Deleted files have no mtime; count them only when there is no stamp to compare with.
    if [ -n "$STAMP" ] && [ -f "$STAMP" ]; then
        [ -e "$f" ] || continue
        [ "$f" -nt "$STAMP" ] || continue
    fi
    # CURRENT_STATE.md written after this change already covers it.
    if [ -e "$f" ] && [ -f "$STATE_FILE" ] && [ "$STATE_FILE" -nt "$f" ]; then
        continue
    fi
    CODE_CHANGED="$f"
    break
done <<EOF
$CHANGED
EOF

[ -n "$CODE_CHANGED" ] || exit 0

{
    echo "[ WARN ] Dev-OS Hard Rule 13 (Session-End State Obligation):"
    echo "         Tracked files changed in this session (e.g. '$CODE_CHANGED') but docs/CURRENT_STATE.md was not updated."
    echo "         Before finishing, update docs/CURRENT_STATE.md with the completed/in-progress task, current status,"
    echo "         active branch and next steps. (Human opt-out: DEVOS_STOP_GATE=off)"
} >&2
exit 2
