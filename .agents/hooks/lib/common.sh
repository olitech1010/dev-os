# Dev-OS hook shared helpers. Sourced (not executed) by every hook in .agents/hooks/.
# bash 3.2 compatible, no external dependencies beyond coreutils and git.

# devos_plugin_gate: when the hooks run from a user-scope Claude Code plugin they fire in
# every project, so they must stand down outside Dev-OS projects.
# Contract: the plugin's hooks.json sets DEVOS_PLUGIN_MODE=1 for each hook command. With it
# set, the calling hook drains stdin and exits 0 with no side effects when either (a) there is
# no .agents/manifest.json at the project root, or (b) the project's own .claude/settings.json
# already wires .agents/hooks/ (the project install owns the hooks; see below). Without
# DEVOS_PLUGIN_MODE=1 this is a no-op.
# Project root: $CLAUDE_PROJECT_DIR, else the git top level of the working directory, else
# the working directory.
devos_plugin_gate() {
    [ "$DEVOS_PLUGIN_MODE" = "1" ] || return 0
    _devos_root="$CLAUDE_PROJECT_DIR"
    if [ -z "$_devos_root" ] || [ ! -d "$_devos_root" ]; then
        _devos_root=$(git rev-parse --show-toplevel 2>/dev/null) || _devos_root=""
        [ -n "$_devos_root" ] || _devos_root=$(pwd)
    fi
    if [ -f "$_devos_root/.agents/manifest.json" ]; then
        # A project that ran `devos init` wires these same hooks in .claude/settings.json. Claude
        # Code dedupes identical handlers only within settings files; a plugin's copy stays
        # separate and runs in parallel, which would double every injection and race on
        # session.json. The project install owns the hooks, so the plugin copy stands down.
        grep -q '\.agents/hooks/' "$_devos_root/.claude/settings.json" 2>/dev/null || return 0
    fi
    # Stand down: drain the payload so the writer never sees EPIPE. The drain runs detached so an
    # open, never-closed stdin cannot hold the hook.
    if [ ! -t 0 ]; then
        cat <&0 >/dev/null 2>&1 &
    fi
    exit 0
}

# devos_project_root: echo the project root. $CLAUDE_PROJECT_DIR when it is a directory, else
# the git top level of the working directory, else the working directory.
devos_project_root() {
    if [ -n "$CLAUDE_PROJECT_DIR" ] && [ -d "$CLAUDE_PROJECT_DIR" ]; then
        printf '%s\n' "$CLAUDE_PROJECT_DIR"
        return 0
    fi
    _r=$(git rev-parse --show-toplevel 2>/dev/null) || _r=""
    [ -n "$_r" ] || _r=$(pwd)
    printf '%s\n' "$_r"
}

# devos_hook_field <payload> <field>: echo a top-level string field of a hook payload.
# Scalar strings only (the fields Dev-OS reads are all strings); absent, null or non-string
# yields the empty string. Intentionally grep-based: these hooks must stay well under 1s and
# must not depend on node (see lib/hook-input.js for the tool-call parser that does).
devos_hook_field() {
    # ERE (grep -E) because BRE alternation is a GNU extension BSD grep does not support.
    printf '%s' "$1" |
        grep -Eo "\"$2\"[[:space:]]*:[[:space:]]*\"([^\"\\\\]|\\\\.)*\"" | head -n 1 |
        sed -e "s/^\"$2\"[[:space:]]*:[[:space:]]*\"//" -e 's/"$//' |
        sed -e 's/\\t/\t/g' -e 's/\\n/ /g' -e 's/\\r/ /g' -e 's/\\"/"/g' -e 's/\\\\/\\/g'
}

# devos_active_task: echo the first task line under '### [ IN_PROGRESS ]' in
# docs/TASK_BOARD.md, with its Assignee when one is given, or "none declared".
# Run from the project root.
devos_active_task() {
    _task="none declared"
    [ -f "docs/TASK_BOARD.md" ] || { printf '%s\n' "$_task"; return 0; }
    _lines=$(awk '/^###[[:space:]]*\[[[:space:]]*IN_PROGRESS[[:space:]]*\]/{f=1;next} /^###[[:space:]]/{f=0} f' docs/TASK_BOARD.md)
    _line=$(printf '%s\n' "$_lines" | grep -E '^[-*][[:space:]]' | head -n 1 | sed -e 's/^[-*][[:space:]]*//' -e 's/\*//g' -e 's/`//g' | cut -c 1-160)
    _who=$(printf '%s\n' "$_lines" | grep -E 'Assignee:' | head -n 1 | sed -e 's/.*Assignee:[*[:space:]]*//' -e 's/\*//g' | cut -c 1-60)
    if [ -n "$_line" ]; then
        _task="$_line"
        [ -n "$_who" ] && _task="$_task (Assignee: $_who)"
    fi
    printf '%s\n' "$_task"
}

# devos_session_mode: echo "<mode> <delegationRequired>" for the current session, read from
# .agents/memory/session.json, falling back to the manifest default, then "interactive false".
# Run from the project root.
devos_session_mode() {
    _mode=""
    _f=".agents/memory/session.json"
    [ -f "$_f" ] && _mode=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' "$_f" | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')
    if [ -z "$_mode" ] && [ -f ".agents/manifest.json" ]; then
        _mode=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' .agents/manifest.json | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')
    fi
    [ -n "$_mode" ] || _mode="interactive"
    _del="false"
    if [ -f "$_f" ] && grep -q '"delegationRequired"[[:space:]]*:[[:space:]]*true' "$_f" 2>/dev/null; then
        _del="true"
    elif [ "$_mode" = "auto" ] || [ "$_mode" = "guided" ]; then
        _del="true"
    fi
    printf '%s %s\n' "$_mode" "$_del"
}

# devos_json_escape: read stdin, print it as the contents of a JSON string (no surrounding
# quotes). Escapes backslash, double quote, the C0 controls JSON forbids, and DEL; newlines
# in the input become \n.
#
# Implemented as a character scan on purpose. awk's gsub() replacement text is NOT portable
# for backslashes: BWK awk (macOS) and gawk disagree on how many backslashes a replacement
# like "\\\\" yields, so a gsub-based escaper silently emits invalid JSON on one of them.
# A scan has no replacement semantics at all, so it behaves the same everywhere.
devos_json_escape() {
    awk '
        BEGIN {
            ORS = ""
            bs = sprintf("%c", 92)
            dq = sprintf("%c", 34)
            # Named escapes JSON defines; everything else below 0x20, plus DEL, goes to \uXXXX.
            esc[sprintf("%c", 8)]  = bs "b"
            esc[sprintf("%c", 9)]  = bs "t"
            esc[sprintf("%c", 12)] = bs "f"
            esc[sprintf("%c", 13)] = bs "r"
            for (i = 1; i < 32; i++) {
                c = sprintf("%c", i)
                if (!(c in esc)) esc[c] = sprintf("%c" "u%04x", 92, i)
            }
            esc[sprintf("%c", 127)] = sprintf("%c" "u007f", 92)
        }
        {
            line = $0
            out = ""
            n = length(line)
            for (i = 1; i <= n; i++) {
                c = substr(line, i, 1)
                if (c == bs || c == dq) out = out bs c
                else if (c in esc) out = out esc[c]
                else out = out c
            }
            print (NR > 1 ? bs "n" : "") out
        }
    '
}

# devos_json_str <value>: the JSON-string body of a single scalar, newlines included.
# Use it for every value interpolated into a JSON file these hooks write; a branch name may
# contain a double quote (git forbids backslash, space and ~^:?*[ but not "), and a task line
# copied out of docs/TASK_BOARD.md may contain a tab.
devos_json_str() {
    printf '%s' "$1" | devos_json_escape
}

# devos_read_session_mode: set MODE and DELEGATION from devos_session_mode without word
# splitting or globbing the result (an unquoted $(...) would expand a mode of "*" to the
# directory listing).
devos_read_session_mode() {
    MODE=""
    DELEGATION=""
    IFS=' ' read -r MODE DELEGATION <<EOF
$(devos_session_mode)
EOF
    [ -n "$MODE" ] || MODE="interactive"
    [ -n "$DELEGATION" ] || DELEGATION="false"
}

# ---------------------------------------------------------------------------
# Cross-harness output (wave 5.2 W6)
# ---------------------------------------------------------------------------
# Every harness takes the same hooks but wants a different shape back. The
# harness is named by the generated config, which prefixes each command with
# DEVOS_HOOK_FORMAT=<harness>, rather than guessed from env markers: guessing
# is wrong exactly when two harnesses run in the same checkout.
#
# Verified 2026-11-08 against each harness's own docs:
#   claude  code.claude.com/docs/en/hooks        plain stdout is injected on
#           SessionStart/UserPromptSubmit; other events need
#           hookSpecificOutput.additionalContext. Blocks on exit 2.
#   codex   learn.chatgpt.com/docs/hooks         SessionStart and
#           UserPromptSubmit take plain text or additionalContext. Blocks on
#           exit 2 with stderr. Same field names as Claude Code.
#   cursor  cursor.com/docs/hooks                keys are snake_case:
#           sessionStart returns additional_context. Exit 2 blocks (= deny).
#   antigravity  antigravity.google/docs/hooks?tab=cli   there is NO
#           additionalContext: context goes in injectSteps[].systemMessage, and
#           PreToolUse needs a REQUIRED {"decision":"deny"} — exit 2 is not
#           documented as a block there, so the JSON decision is the only
#           refusal Dev-OS relies on.
#   opencode  plugin API (typings, not docs)     handled by the JS plugin, which
#           calls these hooks with DEVOS_HOOK_FORMAT=opencode and reads plain
#           stdout, so opencode shares the plain path.

devos_hook_format() {
    case "$DEVOS_HOOK_FORMAT" in
        claude|codex|cursor|antigravity|opencode) printf '%s\n' "$DEVOS_HOOK_FORMAT" ;;
        # Unknown or unset: behave as Claude Code, the shape Dev-OS has always emitted.
        *) printf 'claude\n' ;;
    esac
}

# devos_emit_context <text> [<claude_event_name>]
# Print <text> as context for the calling harness. Empty text prints nothing at
# all, on every harness, so a hook with nothing to say stays silent rather than
# emitting an empty object. <claude_event_name> is the Claude Code hook event
# whose output must be wrapped in hookSpecificOutput (SubagentStart and the like);
# leave it empty for the events whose plain stdout is injected as-is.
devos_emit_context() {
    [ -n "$1" ] || return 0
    _devos_ctx=$(printf '%s' "$1" | devos_json_escape)
    case "$(devos_hook_format)" in
        cursor)
            printf '{"additional_context":"%s"}\n' "$_devos_ctx" ;;
        antigravity)
            printf '{"injectSteps":[{"systemMessage":"%s"}]}\n' "$_devos_ctx" ;;
        *)
            if [ -n "$2" ]; then
                printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' "$2" "$_devos_ctx"
            else
                printf '%s\n' "$1"
            fi ;;
    esac
}

# devos_say <line> / devos_flush_context [<claude_event_name>]
# Collect context a line at a time, then emit it once. A hook cannot print as it
# goes and still produce one JSON object, so every hook that injects context
# buffers through these two and flushes at the end.
DEVOS_CTX_BUF=""
DEVOS_CTX_ANY=0
devos_say() {
    if [ "$DEVOS_CTX_ANY" = "1" ]; then
        DEVOS_CTX_BUF="$DEVOS_CTX_BUF
$1"
    else
        DEVOS_CTX_BUF="$1"
        DEVOS_CTX_ANY=1
    fi
}
devos_flush_context() {
    [ "$DEVOS_CTX_ANY" = "1" ] || return 0
    devos_emit_context "$DEVOS_CTX_BUF" "$1"
    DEVOS_CTX_BUF=""
    DEVOS_CTX_ANY=0
}

# devos_block <reason>
# Refuse the action and EXIT. Exit 2 with the reason on stderr is what Claude
# Code, Codex and Cursor all honour; Antigravity needs its JSON decision instead
# and treats a non-zero exit as a hook error rather than a denial.
devos_block() {
    DEVOS_DECIDED=1
    case "$(devos_hook_format)" in
        antigravity)
            printf '{"decision":"deny","reason":"%s"}\n' "$(printf '%s' "$1" | devos_json_escape)"
            exit 0 ;;
        *)
            printf '%s\n' "$1" >&2
            exit 2 ;;
    esac
}

# devos_allow: say yes in the shape the harness needs. Antigravity marks PreToolUse's
# "decision" Required, so a permitted call has to answer explicitly; every other harness
# treats exit 0 with no output as permission, so nothing is printed there. Verified
# 2026-11-09: antigravity.google/docs/hooks?tab=cli lists allow, auto_approve, deny, ask,
# force_ask and deny_unless_prior_grant as the decision values.
devos_allow() {
    [ "$DEVOS_DECIDED" = "1" ] && return 0
    case "$(devos_hook_format)" in
        antigravity)
            DEVOS_DECIDED=1
            printf '{"decision":"allow"}\n' ;;
        *) : ;;
    esac
}
