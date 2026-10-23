#!/bin/bash

# Dev-OS Runtime Hook: SubagentStop
# Handoff gate: a subagent that changed tracked code in this session must leave a handoff
# note in .agents/memory/handoffs/ before it returns control to the orchestrator.
#
# Interface:
#   Claude Code:  JSON payload on stdin ({hook_event_name:"SubagentStop", stop_hook_active,
#                 agent_id, agent_type, agent_transcript_path, last_assistant_message, cwd, ...}).
#   Manual run:   subagent-stop.sh   (a TTY or empty stdin is treated as {}).
# Exit codes: 0 = let the subagent stop, 2 = keep it working (stderr is shown to the subagent).
# Opt-out: DEVOS_HANDOFF_GATE=off.
#
# Rules:
#   - stop_hook_active true: always exit 0 (the subagent is already continuing because of
#     this hook; blocking again could loop).
#   - If agent_transcript_path is readable and records no Edit/Write/MultiEdit/NotebookEdit
#     tool call, the subagent authored nothing through file tools: exit 0. Read-only agents
#     (Explore, reviewers) therefore never trip the gate; Bash-only writes fall through to the
#     main-session Stop gate (stop.sh).
#   - Otherwise block when a tracked code file outside docs/, .agents/ changed after the
#     session stamp ($(git rev-parse --git-path devos-session-stamp)) and no file in
#     .agents/memory/handoffs/ (other than the template) was written after that stamp.
#     Without a stamp, any modified code file counts and any handoff note satisfies the gate.

# Plugin mode (DEVOS_PLUGIN_MODE=1): stand down outside Dev-OS projects. See lib/common.sh.
_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
fi

if [ "$DEVOS_HANDOFF_GATE" = "off" ]; then
    exit 0
fi

HOOK_INPUT=""
if [ ! -t 0 ]; then
    IFS= read -r -d '' -t 2 HOOK_INPUT || true
fi
if printf '%s' "$HOOK_INPUT" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    exit 0
fi

# Only file-authoring subagents need a handoff note.
TRANSCRIPT=$(printf '%s' "$HOOK_INPUT" | grep -o '"agent_transcript_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')
case "$TRANSCRIPT" in
    "~/"*) TRANSCRIPT="$HOME/${TRANSCRIPT#\~/}" ;;
esac
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ] && [ -r "$TRANSCRIPT" ]; then
    if ! grep -Eq '"name"[[:space:]]*:[[:space:]]*"(Edit|Write|MultiEdit|NotebookEdit)"' "$TRANSCRIPT" 2>/dev/null; then
        exit 0
    fi
fi

if [ -n "$CLAUDE_PROJECT_DIR" ]; then
    cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
fi
TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$TOPLEVEL" 2>/dev/null || exit 0

if git rev-parse --verify -q HEAD >/dev/null 2>&1; then
    CHANGED=$(git diff --name-only HEAD -- 2>/dev/null)
else
    CHANGED=$( { git diff --name-only --cached -- ; git diff --name-only -- ; } 2>/dev/null | sort -u)
fi
[ -n "$CHANGED" ] || exit 0

STAMP=$(git rev-parse --git-path devos-session-stamp 2>/dev/null)
[ -n "$STAMP" ] && [ -f "$STAMP" ] || STAMP=""

CODE_RE='\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|php|vue|svelte|css|scss|html|sql|sh|c|cc|cpp|h|hpp|cs)$'
CODE_CHANGED=""
while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in
        docs/*|.agents/*) continue ;;
    esac
    printf '%s' "$f" | grep -Eq "$CODE_RE" || continue
    if [ -n "$STAMP" ]; then
        [ -e "$f" ] || continue
        [ "$f" -nt "$STAMP" ] || continue
    fi
    CODE_CHANGED="$f"
    break
done <<EOF
$CHANGED
EOF
[ -n "$CODE_CHANGED" ] || exit 0

HANDOFF_DIR=".agents/memory/handoffs"
if [ -d "$HANDOFF_DIR" ]; then
    for h in "$HANDOFF_DIR"/*; do
        [ -f "$h" ] || continue
        case "$h" in */handoff-template.md) continue ;; esac
        if [ -z "$STAMP" ] || [ "$h" -nt "$STAMP" ]; then
            exit 0
        fi
    done
fi

{
    echo "[ WARN ] Dev-OS handoff gate (SubagentStop):"
    echo "         You changed tracked code in this session (e.g. '$CODE_CHANGED') but wrote no handoff note."
    echo "         Before returning, write .agents/memory/handoffs/<YYYY-MM-DD-HHMM>-<agent>.md covering:"
    echo "           - What changed: files and the reason for each change."
    echo "           - Verification run: commands executed (tests, linters, scanners) and their results."
    echo "           - Open issues: anything unfinished, risks, and questions for the orchestrator."
    echo "         (Template: .agents/memory/handoffs/handoff-template.md. Human opt-out: DEVOS_HANDOFF_GATE=off)"
} >&2
exit 2
