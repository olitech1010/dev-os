#!/bin/bash

# Dev-OS Runtime Hook: PostCompact
# Records that compaction happened, and how large the summary was.
#
# Interface (verified 2026-11-06 against code.claude.com/docs/en/hooks, CLI 2.1.319):
#   Payload on stdin: {hook_event_name:"PostCompact", trigger:"manual"|"auto",
#                      compact_summary: string, session_id, transcript_path, cwd, ...}
#   Output: none. PostCompact has NO decision control and no context injection; stdout,
#           systemMessage and continue are all discarded. Side effects only.
#   The post-compaction context is re-injected by session-start.sh, which Claude Code fires
#   with source "compact". Do not print anything here: it would be dropped.
#
# compact_summary is deliberately NOT written to disk. It is conversation content, it can be
# large, and persisting it to a file in the repo would put session text somewhere the human
# did not ask for it. Only its size is recorded.

_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
else
    exit 0
fi

# Bounded read, like every other Dev-OS hook: an unbounded `cat` would wait for EOF, and the
# documented default timeout for a command hook is 600 seconds. A summary too large to read
# within the window is reported as a partial read rather than held onto.
HOOK_INPUT=""
PAYLOAD_READ="full"
if [ ! -t 0 ]; then
    IFS= read -r -d '' -t 2 HOOK_INPUT || PAYLOAD_READ="partial"
fi
TRIGGER=$(devos_hook_field "$HOOK_INPUT" trigger)
[ -n "$TRIGGER" ] || TRIGGER="unknown"

# Decoded length of compact_summary. The scan requires a string value immediately after the
# key, so "compact_summary": null measures 0 instead of running on to the next string in the
# payload, and a two-character escape or a \uXXXX escape each count as one character.
SUMMARY_CHARS=$(printf '%s' "$HOOK_INPUT" | awk '
    BEGIN { bs = sprintf("%c", 92); dq = sprintf("%c", 34); key = dq "compact_summary" dq; total = 0; found = 0 }
    found { next }
    {
        p = index($0, key)
        if (p == 0) next
        rest = substr($0, p + length(key))
        # Skip blanks and the colon; the next character must open a string.
        i = 1
        n = length(rest)
        while (i <= n && (substr(rest, i, 1) == " " || substr(rest, i, 1) == "\t" || substr(rest, i, 1) == ":")) i++
        if (i > n || substr(rest, i, 1) != dq) { found = 1; next }
        i++
        while (i <= n) {
            c = substr(rest, i, 1)
            if (c == bs) {
                nxt = substr(rest, i + 1, 1)
                total++
                i += (nxt == "u") ? 6 : 2
                continue
            }
            if (c == dq) break
            total++
            i++
        }
        found = 1
    }
    END { print total + 0 }
')
case "$SUMMARY_CHARS" in ''|*[!0-9]*) SUMMARY_CHARS=0 ;; esac

cd "$(devos_project_root)" 2>/dev/null || exit 0
[ -d ".agents" ] || exit 0
mkdir -p .agents/memory 2>/dev/null

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
STATE=".agents/memory/compact-state.json"

# Rewrite the record whole rather than editing the JSON as text: savedAt and trigger are
# carried over from what pre-compact.sh saved (it ran moments ago, in the same compaction),
# and everything else is re-derived here.
SAVED_AT=""
if [ -f "$STATE" ]; then
    SAVED_AT=$(grep -o '"savedAt"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE" | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')
    PREV_TRIGGER=$(grep -o '"trigger"[[:space:]]*:[[:space:]]*"[^"]*"' "$STATE" | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')
    [ "$TRIGGER" = "unknown" ] && [ -n "$PREV_TRIGGER" ] && TRIGGER="$PREV_TRIGGER"
fi
[ -n "$SAVED_AT" ] || SAVED_AT="$TIMESTAMP"

ACTIVE_TASK=$(devos_active_task)
devos_read_session_mode
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
case "$DIRTY" in ''|*[!0-9]*) DIRTY=0 ;; esac

cat > "$STATE" <<EOF
{
  "schemaVersion": "1.0.0",
  "savedAt": "$SAVED_AT",
  "compactedAt": "$TIMESTAMP",
  "trigger": "$(devos_json_str "$TRIGGER")",
  "summaryChars": $SUMMARY_CHARS,
  "payloadRead": "$PAYLOAD_READ",
  "mode": "$(devos_json_str "$MODE")",
  "delegationRequired": $( [ "$DELEGATION" = "true" ] && echo true || echo false ),
  "branch": "$(devos_json_str "$BRANCH")",
  "dirtyFiles": $DIRTY,
  "activeTask": "$(devos_json_str "$ACTIVE_TASK")"
}
EOF

exit 0
