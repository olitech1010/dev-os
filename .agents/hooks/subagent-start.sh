#!/bin/bash

# Dev-OS Runtime Hook: SubagentStart
# Injects the active task contract into every subagent, so a specialist starts with the same
# operating rules the main session has instead of only its own persona file.
#
# Interface (verified 2026-11-06 against code.claude.com/docs/en/hooks, CLI 2.1.319):
#   Payload on stdin: {hook_event_name:"SubagentStart", agent_id, agent_type,
#                      session_id, transcript_path, cwd, ...}
#   Output: context only. On Claude Code the documented form is
#     {"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"..."}};
#     the docs describe no plain-stdout form for this event, so the envelope is used.
#     devos_emit_context renders the equivalent shape for the other harnesses.
#   Blocking: none. SubagentStart cannot deny a spawn; exit 2 only shows stderr in the
#   subagent's transcript. This hook always exits 0.
#   The matcher would filter by agent type; Dev-OS wires it without one so every subagent,
#   including Explore and third-party agents, gets the contract.
#
# Opt-out: DEVOS_SUBAGENT_CONTRACT=off.

_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
else
    exit 0
fi

[ "$DEVOS_SUBAGENT_CONTRACT" = "off" ] && exit 0

HOOK_INPUT=""
if [ ! -t 0 ]; then
    IFS= read -r -d '' -t 2 HOOK_INPUT || true
fi
AGENT_TYPE=$(devos_hook_field "$HOOK_INPUT" agent_type)
[ -n "$AGENT_TYPE" ] || AGENT_TYPE="unnamed subagent"

cd "$(devos_project_root)" 2>/dev/null || exit 0
# Outside a Dev-OS project there is no contract to inject.
[ -d ".agents" ] || exit 0

ACTIVE_TASK=$(devos_active_task)
devos_read_session_mode
PLAN=$(ls -t docs/plans/*.md 2>/dev/null | head -n 1)

CONTEXT=$(
    echo "Dev-OS task contract for this subagent ($AGENT_TYPE). These rules outrank your persona file."
    echo "- Session mode: $MODE. You are a specialist inside an orchestrated session; stay inside your role."
    echo "- Active task (docs/TASK_BOARD.md): $ACTIVE_TASK"
    [ -n "$PLAN" ] && echo "- Approved plan in play: $PLAN. Do not widen its scope on your own initiative."
    echo "- You never commit. Raw 'git commit' is blocked (R8); the human commits via .agents/scripts/commit.sh."
    echo "- No destructive action (delete, drop, truncate, force-push, reset --hard) without an approved"
    echo "  dry-run plan (R1). No secrets in code, logs or output; read them from process.env (R2)."
    echo "- Verify library APIs before you write against them (R11). Confirm, do not assume."
    echo "- If you change tracked code, write a handoff note in .agents/memory/handoffs/ before you return:"
    echo "  what changed and why, the verification commands you ran with their real output, and what is open."
    echo "  The SubagentStop gate blocks your return without one."
    echo "- After 3 failed fix iterations on one task, stop and report instead of trying again (R10)."
    echo "- Full rules: .agents/AGENTS.md. Report what you actually ran; never claim a gate passed unseen."
)

# Cursor (subagentStart) and Codex (SubagentStart) are wired to this hook too, and each wants
# its own reply shape, so the output goes through the shared layer rather than being hand-built.
devos_emit_context "$CONTEXT" SubagentStart

exit 0
