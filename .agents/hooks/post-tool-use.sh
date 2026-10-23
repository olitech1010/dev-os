#!/bin/bash

# Dev-OS Runtime Hook: PostToolUse (matcher "Edit|Write|MultiEdit")
# Runs the file-scoped mechanical scanner for the file the tool just wrote and feeds any
# findings back to the model:
#   *.tsx *.jsx *.vue *.svelte *.html  -> .agents/scripts/ui-taste-check.sh <file>
#   .env*                              -> .agents/scripts/env-check.sh <file>   (file mode)
#   *.sql                              -> .agents/scripts/db-check.sh <file>
#
# Interface:
#   Claude Code:  JSON payload on stdin ({hook_event_name:"PostToolUse", tool_name,
#                 tool_input:{file_path,...}, tool_response, cwd, ...}).
# Exit codes: 0 = nothing to report, 2 = findings on stderr. PostToolUse runs after the tool,
# so exit 2 does not undo the write: Claude Code shows the stderr to Claude as feedback.
# Budget: the scanner gets DEVOS_POST_CHECK_TIMEOUT tenths of a second (default 20 = 2s) and is
# killed after that; files over 1 MB, outside the project, or under node_modules/.git/.agents
# are skipped. Opt-out: DEVOS_POST_CHECKS=off. Never fails the tool call on its own errors.

# Plugin mode (DEVOS_PLUGIN_MODE=1): stand down outside Dev-OS projects. See lib/common.sh.
_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
fi

if [ "$DEVOS_POST_CHECKS" = "off" ]; then
    exit 0
fi

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
HELPER="$HOOK_DIR/lib/hook-input.js"

RAW_INPUT=""
if [ ! -t 0 ]; then
    IFS= read -r -d '' -t 2 RAW_INPUT || true
fi
[ -n "$RAW_INPUT" ] || exit 0

# Cheap pre-filter: most edits touch files no scanner covers, so skip node entirely.
printf '%s' "$RAW_INPUT" | grep -Eq '"file_path"' || exit 0
printf '%s' "$RAW_INPUT" | grep -Eiq '\.(tsx|jsx|vue|svelte|html|sql)"|\.env' || exit 0

[ -f "$HELPER" ] && command -v node >/dev/null 2>&1 || exit 0
PARSED=$(printf '%s' "$RAW_INPUT" | node "$HELPER" 2>/dev/null) || exit 0

TOOL_NAME=""; ROOT=""; TARGET=""
while IFS= read -r line; do
    case "$line" in
        TOOL_NAME=*) TOOL_NAME="${line#TOOL_NAME=}" ;;
        ROOT=*)      ROOT="${line#ROOT=}" ;;
        TARGET=*)    [ -n "$TARGET" ] || TARGET="${line#TARGET=}" ;;
    esac
done <<EOF
$PARSED
EOF

case "$TOOL_NAME" in Edit|Write|MultiEdit) ;; *) exit 0 ;; esac
[ -n "$TARGET" ] && [ -n "$ROOT" ] || exit 0
cd "$ROOT" 2>/dev/null || exit 0

case "/$TARGET" in
    */node_modules/*|*/.git/*|*/.agents/*|*/dist/*|*/build/*|*/.next/*) exit 0 ;;
esac
[ -f "$TARGET" ] || exit 0

BASE=$(basename "$TARGET")
CHECK=""
case "$BASE" in
    *.tsx|*.jsx|*.vue|*.svelte|*.html) CHECK="ui-taste-check.sh" ;;
    *.sql)                             CHECK="db-check.sh" ;;
    .env|.env.*)                       CHECK="env-check.sh" ;;
esac
[ -n "$CHECK" ] || exit 0

SCRIPT=".agents/scripts/$CHECK"
[ -f "$SCRIPT" ] || exit 0

SIZE=$(wc -c < "$TARGET" 2>/dev/null | tr -cd '0-9')
if [ -n "$SIZE" ] && [ "$SIZE" -gt 1048576 ]; then
    exit 0
fi

LIMIT="${DEVOS_POST_CHECK_TIMEOUT:-20}"
case "$LIMIT" in ''|*[!0-9]*) LIMIT=20 ;; esac

OUT_FILE=$(mktemp "${TMPDIR:-/tmp}/devos-post.XXXXXX" 2>/dev/null) || exit 0
bash "$SCRIPT" "$TARGET" > "$OUT_FILE" 2>&1 &
PID=$!
WAITED=0
while kill -0 "$PID" 2>/dev/null && [ "$WAITED" -lt "$LIMIT" ]; do
    sleep 0.1
    WAITED=$((WAITED + 1))
done
if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    rm -f "$OUT_FILE"
    echo "[ WARN ] Dev-OS post-edit check: $CHECK timed out on '$TARGET'; run it manually." >&2
    exit 0
fi
wait "$PID" 2>/dev/null
RC=$?
OUTPUT=$(cat "$OUT_FILE" 2>/dev/null)
rm -f "$OUT_FILE"

[ "$RC" -ne 0 ] || exit 0

{
    echo "[ WARN ] Dev-OS post-edit check ($CHECK) reported issues in '$TARGET'."
    echo "         The edit was applied; fix these findings now (or explain why they are intentional):"
    printf '%s\n' "$OUTPUT" | grep -v '^Dev-OS .*Scanning' | grep -v '^[[:space:]]*$' | head -n 30
} >&2
exit 2
