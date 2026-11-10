#!/bin/bash

# Dev-OS Runtime Hook: PreCompact
# Saves the operating state that compaction would otherwise drop, and tells the summariser
# what it must keep.
#
# Interface (verified 2026-11-06 against code.claude.com/docs/en/hooks, CLI 2.1.319):
#   Payload on stdin: {hook_event_name:"PreCompact", trigger:"manual"|"auto",
#                      custom_instructions: string|null, session_id, transcript_path, cwd, ...}
#   Output: on exit 0 Claude Code uses this hook's STDOUT as instructions for the compaction
#           summary, capped at 10,000 characters per hook. It is NOT additionalContext.
#   Blocking: exit 2, or {"decision":"block"}, would cancel compaction. Dev-OS never blocks
#           compaction: refusing an auto-compact that is recovering from a context-limit error
#           makes the request fail outright. This hook always exits 0.
#   systemMessage and continue are discarded on this event.
#
# The context the model needs AFTER compaction is injected by session-start.sh (SessionStart
# fires with source "compact"); PostCompact cannot inject context at all. This hook's job is
# the other half: steer the summary, and persist state to .agents/memory/compact-state.json
# so post-compact.sh and the human can see what the session was doing when it compacted.

# Plugin mode (DEVOS_PLUGIN_MODE=1): stand down outside Dev-OS projects. See lib/common.sh.
_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
else
    exit 0
fi

HOOK_INPUT=""
if [ ! -t 0 ]; then
    IFS= read -r -d '' -t 2 HOOK_INPUT || true
fi
TRIGGER=$(devos_hook_field "$HOOK_INPUT" trigger)
[ -n "$TRIGGER" ] || TRIGGER="unknown"

cd "$(devos_project_root)" 2>/dev/null || exit 0

ACTIVE_TASK=$(devos_active_task)
devos_read_session_mode
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
case "$DIRTY" in ''|*[!0-9]*) DIRTY=0 ;; esac
PLAN=$(ls -t docs/plans/*.md 2>/dev/null | head -n 1)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Persist the pre-compaction state. Untracked (.gitignore); read by post-compact.sh and
# useful to the human when a long session is reconstructed after the fact.
# Every interpolated value goes through devos_json_str: a branch name can hold a double quote
# and a task line can hold a tab, either of which would otherwise produce unparseable JSON.
if [ -d ".agents" ]; then
    mkdir -p .agents/memory 2>/dev/null
    cat > .agents/memory/compact-state.json <<EOF
{
  "schemaVersion": "1.0.0",
  "savedAt": "$TIMESTAMP",
  "trigger": "$(devos_json_str "$TRIGGER")",
  "mode": "$(devos_json_str "$MODE")",
  "delegationRequired": $( [ "$DELEGATION" = "true" ] && echo true || echo false ),
  "branch": "$(devos_json_str "$BRANCH")",
  "dirtyFiles": $DIRTY,
  "activeTask": "$(devos_json_str "$ACTIVE_TASK")",
  "plan": "$(devos_json_str "$PLAN")"
}
EOF
fi

# Summary instructions. Kept short on purpose: this text is spent on every compaction, and
# the full directive is re-injected by session-start.sh immediately afterwards.
echo "Dev-OS: preserve the following in the compaction summary, verbatim where it is a value:"
echo "- Operating mode: $MODE (delegation required: $DELEGATION). Modes change only via 'devos mode <mode>'."
echo "- Active task (docs/TASK_BOARD.md): $ACTIVE_TASK"
[ -n "$PLAN" ] && echo "- Approved plan in play: $PLAN"
echo "- Branch $BRANCH, $DIRTY uncommitted path(s). Keep any file the session edited but has not verified."
echo "- Hard Rules still bind: no destructive action without an approved dry-run plan (R1); agents never"
echo "  commit on their own initiative (R6/R8, humans use .agents/scripts/commit.sh); update"
echo "  docs/CURRENT_STATE.md before the session ends (R13)."
echo "- Circuit breaker: keep the count of failed fix iterations on the current task, and which gate"
echo "  output failed each time. Three failures means HALT and escalate (R10)."
echo "- Keep every unresolved question put to the human, and every decision they already made."

exit 0
