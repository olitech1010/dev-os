#!/bin/bash

# Dev-OS Runtime Hook: InstructionsLoaded
# Logs every instruction file Claude Code loads, so `devos doctor` can PROVE the CLAUDE.md ->
# AGENTS.md import actually resolved instead of inferring it from the file's text.
#
# Interface (verified 2026-11-06 against code.claude.com/docs/en/hooks, CLI 2.1.319):
#   Payload on stdin, ONE event per file: {hook_event_name:"InstructionsLoaded", file_path,
#     memory_type:"User"|"Project"|"Local"|"Managed",
#     load_reason:"session_start"|"nested_traversal"|"path_glob_match"|"include"|"compact",
#     globs?, trigger_file_path?, parent_file_path?, ...}
#   There is no instruction_files array: the event fires per file.
#   Output: none. The exit code is ignored and there is no decision control or context
#   injection. This hook must stay cheap: it can fire many times per session.
#
# Log: .agents/memory/instructions-loaded.log (untracked). Each row carries the session id and
# doctor reads only the newest session's rows, so the log is append-only and bounded by a line
# cap rather than truncated per session. Opt-out: DEVOS_INSTR_LOG=off.

_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
else
    exit 0
fi

[ "$DEVOS_INSTR_LOG" = "off" ] && exit 0

HOOK_INPUT=""
if [ ! -t 0 ]; then
    IFS= read -r -d '' -t 2 HOOK_INPUT || true
fi
FILE_PATH=$(devos_hook_field "$HOOK_INPUT" file_path)
[ -n "$FILE_PATH" ] || exit 0
SESSION_ID=$(devos_hook_field "$HOOK_INPUT" session_id)
MEMORY_TYPE=$(devos_hook_field "$HOOK_INPUT" memory_type)
LOAD_REASON=$(devos_hook_field "$HOOK_INPUT" load_reason)
PARENT=$(devos_hook_field "$HOOK_INPUT" parent_file_path)
[ -n "$SESSION_ID" ] || SESSION_ID="unknown"
[ -n "$MEMORY_TYPE" ] || MEMORY_TYPE="unknown"
[ -n "$LOAD_REASON" ] || LOAD_REASON="unknown"
# Tabs are the field separator, so they must not survive inside a field.
SESSION_ID=$(printf '%s' "$SESSION_ID" | tr -d '\t' | cut -c 1-64)

cd "$(devos_project_root)" 2>/dev/null || exit 0
[ -d ".agents" ] || exit 0
mkdir -p .agents/memory 2>/dev/null
LOG=".agents/memory/instructions-loaded.log"

# Each row carries the session id, and `devos doctor` reads only the newest session's rows.
# That is what keeps the report honest: an earlier truncate-on-session-start scheme depended
# on this asynchronous event losing a race against SessionStart, and when it lost the other
# way a row from a previous session could prove an import that had since broken.
printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$SESSION_ID" "$MEMORY_TYPE" "$LOAD_REASON" "$FILE_PATH" "$PARENT" >> "$LOG" 2>/dev/null

# Hard cap: an instruction set with many lazily loaded rules files must not grow unbounded.
# Trimming keeps the tail, so the newest session's rows always survive.
LINES=$(wc -l < "$LOG" 2>/dev/null | tr -d ' ')
case "$LINES" in ''|*[!0-9]*) LINES=0 ;; esac
if [ "$LINES" -gt 400 ]; then
    tail -n 200 "$LOG" > "$LOG.tmp.$$" 2>/dev/null && mv "$LOG.tmp.$$" "$LOG" 2>/dev/null || rm -f "$LOG.tmp.$$" 2>/dev/null
fi

exit 0
