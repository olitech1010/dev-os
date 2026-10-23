#!/bin/bash

# Dev-OS Runtime Hook: SessionEnd
# Side-effect-free reminder for Hard Rule 13 (Session-End State Obligation).
# SessionEnd output never reaches the model, so enforcement lives in stop.sh (Stop event);
# this hook only prints a reminder to stdout (Claude Code's debug log / a manual run).
# It writes no files, never blocks, and stays well inside the SessionEnd time budget.
#
# Interface: Claude Code sends JSON on stdin ({hook_event_name:"SessionEnd", reason, ...});
# it is drained, not used. Always exits 0.

# Plugin mode (DEVOS_PLUGIN_MODE=1): stand down outside Dev-OS projects. See lib/common.sh.
_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
fi

if [ ! -t 0 ]; then IFS= read -r -d '' -t 1 _DISCARD || true; fi

if [ -n "$CLAUDE_PROJECT_DIR" ] && [ -d "$CLAUDE_PROJECT_DIR" ]; then
    cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || true
fi

TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$TOPLEVEL" 2>/dev/null || exit 0

# Modified tracked files (staged or unstaged), excluding docs/.
CHANGED=$(git status --porcelain --untracked-files=no 2>/dev/null | cut -c 4- | grep -v '^docs/' | head -n 1)
[ -n "$CHANGED" ] || exit 0

STATE_CHANGED=$(git status --porcelain docs/CURRENT_STATE.md 2>/dev/null)
STATE_NEWER=""
if [ -f docs/CURRENT_STATE.md ] && [ -e "$CHANGED" ] && [ docs/CURRENT_STATE.md -nt "$CHANGED" ]; then
    STATE_NEWER="1"
fi

if [ -z "$STATE_CHANGED" ] && [ -z "$STATE_NEWER" ]; then
    echo "[ WARN ] Dev-OS Hard Rule 13 reminder: tracked files are modified but docs/CURRENT_STATE.md"
    echo "         was not updated. Update it with current status and next steps."
fi

exit 0
