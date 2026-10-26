#!/bin/bash

# Dev-OS Runtime Hook: PreToolUse
# Enforces Hard Rule 1 (Zero Destructive Actions), Hard Rule 8 (Mechanical Commit Gate),
# Hard Rule 15 (Mandatory Design Gate: DESIGN.md at project root before frontend UI authoring),
# the optional Task Board gate, and Hard Rule 23 (Orchestration Gate).
#
# Interface:
#   Claude Code:  JSON payload on stdin ({tool_name, tool_input:{command|file_path|...}, cwd, ...}).
#   Test mode:    pre-tool-use.sh '<bash command>'   (positional args are treated as a Bash command)
# Exit codes: 0 = allow, 2 = block (reason on stderr, which Claude Code feeds back to the model).
#
# Escape hatches (read from the hook's own environment, never from the command text):
#   DEVOS_DESTRUCTIVE_APPROVED=true, DEVOS_COMMIT_APPROVED=true, DEVOS_SOLO_APPROVED=true.
#   Optional strict gates: DEVOS_ENFORCE_TASK_BOARD=1, DEVOS_ENFORCE_ORCHESTRATOR=1.
#   DEVOS_TRIVIAL_FASTPATH=off disables the TRIVIAL fast path described below.
#
# TRIVIAL fast path: the Design Gate and the Orchestration Gate let a small Edit through when
# the file already exists, the edit changes under 30 lines (and under ~6 KB), and the path is
# not a dependency manifest, schema/migration or auth-related file. Changed lines are charged
# to a per-session budget in $(git rev-parse --git-path devos-trivial-budget), keyed on the
# payload's session_id: it resets only when the session_id changes (a resumed session keeps its
# id and its spent budget). Without a session_id it resets when session-start.sh writes a new
# session stamp. Once the session total would exceed 30
# lines the gates apply normally. Write, MultiEdit, NotebookEdit and Bash never qualify.
#
# This hook is a guard, not a sandbox: it parses command text. The authoritative commit
# protections live in .agents/scripts/commit.sh and the git pre-commit hook, which refuse
# to run in agent shells. Known residual risk: `bash script.sh`, `python -c ...` and other
# interpreters running a file or string are not inspected; the pre-commit hook is the backstop.
# Stdin is read by node (lib/hook-input.js) directly: a bash `read` of a multi-megabyte payload
# is byte-at-a-time and timed out, which used to skip every gate. If node or the helper is
# missing or fails before reading, bash reads whatever stdin remains and a conservative regex
# over the raw input runs instead and blocks on a match (fail closed). Input cut off by a read
# timeout, or that looks like JSON but does not parse (PARSE=partial), gets the same regex plus
# the Design and Orchestration Gates over its file_path, or over every path-like string when no
# file_path can be found.
#
# Gate state is off limits to tool calls: any write, move or delete of .git/devos-* (TRIVIAL
# budget, session stamp) or .git/hooks/*, any Bash command naming the budget/stamp files, and
# `git config core.hooksPath <value>` are blocked.

# Plugin mode (DEVOS_PLUGIN_MODE=1): stand down outside Dev-OS projects. See lib/common.sh.
_DEVOS_HD="${BASH_SOURCE[0]%/*}"; [ "$_DEVOS_HD" = "${BASH_SOURCE[0]}" ] && _DEVOS_HD=.
if [ -f "$_DEVOS_HD/lib/common.sh" ]; then
    . "$_DEVOS_HD/lib/common.sh"
    devos_plugin_gate
fi

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
HELPER="$HOOK_DIR/lib/hook-input.js"

# node reads the payload itself (see header); RAW_INPUT is only filled when it could not.
RAW_INPUT=""
RAW_PARTIAL="0"
PARSED=""
HELPER_RC=1
if [ -f "$HELPER" ] && command -v node >/dev/null 2>&1; then
    if [ $# -gt 0 ]; then
        PARSED=$(node "$HELPER" --command "$*" 2>/dev/null)
    else
        PARSED=$(node "$HELPER" 2>/dev/null)
    fi
    HELPER_RC=$?
fi

PARSE=""; TOOL_NAME=""; COMMAND=""; ROOT=""; GIT_COMMIT="0"; APPROVAL_ENV="0"; MARKER_TAMPER="0"; COMMIT_SH="none"
DESTRUCTIVE=""; UNSURE="0"; TARGETS=""; UTARGETS=""
EDIT_EXISTS="0"; EDIT_LINES=""; EDIT_BYTES=""; SESSION_ID=""; PROTECTED=""; FALLBACK="0"
while IFS= read -r line; do
    case "$line" in
        PARSE=*)         PARSE="${line#PARSE=}" ;;
        TOOL_NAME=*)     TOOL_NAME="${line#TOOL_NAME=}" ;;
        COMMAND=*)       COMMAND="${line#COMMAND=}" ;;
        ROOT=*)          ROOT="${line#ROOT=}" ;;
        GIT_COMMIT=*)    GIT_COMMIT="${line#GIT_COMMIT=}" ;;
        APPROVAL_ENV=*)  APPROVAL_ENV="${line#APPROVAL_ENV=}" ;;
        MARKER_TAMPER=*) MARKER_TAMPER="${line#MARKER_TAMPER=}" ;;
        COMMIT_SH=*)     COMMIT_SH="${line#COMMIT_SH=}" ;;
        DESTRUCTIVE=*)   DESTRUCTIVE="${line#DESTRUCTIVE=}" ;;
        UNSURE=*)        UNSURE="${line#UNSURE=}" ;;
        EDIT_EXISTS=*)   EDIT_EXISTS="${line#EDIT_EXISTS=}" ;;
        EDIT_LINES=*)    EDIT_LINES="${line#EDIT_LINES=}" ;;
        EDIT_BYTES=*)    EDIT_BYTES="${line#EDIT_BYTES=}" ;;
        SESSION_ID=*)    SESSION_ID="${line#SESSION_ID=}" ;;
        PROTECTED=*)     [ -n "$PROTECTED" ] || PROTECTED="${line#PROTECTED=}" ;;
        TARGET=*)        TARGETS="${TARGETS}${line#TARGET=}
" ;;
        UTARGET=*)       UTARGETS="${UTARGETS}${line#UTARGET=}
" ;;
    esac
done <<EOF
$PARSED
EOF

# Fail closed when the helper is missing or crashed but there was input: run a conservative
# regex over the raw text (JSON payload or positional command) and block on a match.
# Mirrors fallbackScan() in lib/hook-input.js.
fallback_reason() {
    FB=$(printf '%s' "$1" | sed -e 's/\\n/ ; /g' -e 's/\\t/ /g' | tr -d "'\"\\\\")
    B='(^|[^A-Za-z0-9_.-])'
    if printf '%s' "$FB" | grep -Eq 'DEVOS_(HEADLESS_COMMIT|COMMIT_APPROVED|AGENT_COMMIT)'; then
        echo "self-approval variable"; return 0
    fi
    # commit.sh only as the literal command word .agents/scripts/commit.sh (see hook-input.js COMMIT_SH)
    if printf '%s' "$FB" | grep -oE '[^[:space:];&|()]*commit\.sh' | grep -vqx '\.agents/scripts/commit\.sh' \
        || printf '%s' "$FB" | grep -Eq "${B}(bash|sh|zsh|dash|ksh|source|eval|\.)[[:space:]]+[^;&|]*commit\.sh"; then
        echo "commit.sh run in a non-canonical form"; return 0
    fi
    if printf '%s' "$FB" | grep -Eq 'devos-(trivial-budget|session-stamp)|\.git/(worktrees/[^/]+/)?(devos-|hooks/)'; then
        echo "Dev-OS gate state (.git/devos-*, .git/hooks/*)"; return 0
    fi
    if printf '%s' "$FB" | grep -Eq "${B}git([^A-Za-z0-9_.-][^;&|]*)?[[:space:]](commit|commit-tree|merge|cherry-pick|revert|am)([^A-Za-z0-9_-]|\$)|alias\.[A-Za-z0-9_-]+=[[:space:]]*!?[[:space:]]*(git[[:space:]]+)?commit"; then
        echo "git commit"; return 0
    fi
    if printf '%s' "$FB" | grep -Eq "${B}rm[[:space:]]+([^;&|]*[[:space:]])?(-[A-Za-z]*([rR][A-Za-z]*f|f[A-Za-z]*[rR])|--recursive|--force)"; then
        echo "rm -rf"; return 0
    fi
    if printf '%s' "$FB" | grep -Eq "${B}git[^;&|]*[[:space:]](reset[^;&|]*--hard|clean[^;&|]*([[:space:]]-[A-Za-z]*f|--force)|push[^;&|]*([[:space:]]--force([^-]|\$)|[[:space:]]-[A-Za-z]*f([^A-Za-z]|\$)|[[:space:]][+][^[:space:]])|branch[^;&|]*[[:space:]]-[A-Za-z]*D)"; then
        echo "destructive git command"; return 0
    fi
    if printf '%s' "$FB" | grep -Eiq '(DROP[[:space:]]+(TABLE|DATABASE|SCHEMA)|TRUNCATE[[:space:]]+TABLE)'; then
        echo "SQL DROP/TRUNCATE"; return 0
    fi
    if printf '%s' "$FB" | grep -Eq "${B}(mkfs|find[^;&|]*[[:space:]]-delete)|aws[[:space:]]+s3[[:space:]]+(rm|rb)([^A-Za-z]|\$)|gcloud[^;&|]*projects[[:space:]]+delete"; then
        echo "destructive command"; return 0
    fi
    if printf '%s' "$FB" | grep -Eq "(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|GEMINI_CLI|CODEX_SANDBOX|CODEX_THREAD_ID|CURSOR_AGENT|AI_AGENT|env[[:space:]]+-[A-Za-z]*i|exec[[:space:]]+-[A-Za-z]*c)" \
        && printf '%s' "$FB" | grep -Eq "commit\.sh|${B}git([^A-Za-z0-9_.-]|\$)"; then
        echo "agent marker tampering"; return 0
    fi
    if printf '%s' "$FB" | grep -Eq "${B}(script|expect|unbuffer|socat|empty|ptyrun|pty)[[:space:]]" \
        && printf '%s' "$FB" | grep -Eq "commit\.sh|${B}git([^A-Za-z0-9_.-]|\$)"; then
        echo "commit through a pty wrapper"; return 0
    fi
    return 1
}

case "$PARSE" in
    json|raw|empty) ;;
    partial)
        # The helper ran its own fallback regex (GIT_COMMIT/DESTRUCTIVE/...) and extracted the
        # targets; the gates below run with the TRIVIAL fast path disabled.
        FALLBACK="1"
        echo "[ WARN ] Dev-OS pre-tool-use: the hook payload could not be fully read or parsed; conservative checks applied." >&2
        ;;
    *)
        # The helper is missing or failed before reading: read what remains of stdin here.
        if [ $# -gt 0 ]; then
            RAW_INPUT="$*"
        elif [ ! -t 0 ]; then
            # bash 3.2 `read -t` discards everything on timeout and reads a pipe byte by byte,
            # so prefer a block-wise perl read with a 3 s alarm that keeps what arrived.
            # Either way an exit status over 128 means the read timed out (partial input).
            if command -v perl >/dev/null 2>&1; then
                RAW_INPUT=$(perl -e '$SIG{ALRM} = sub { exit 142 }; alarm 3; $| = 1; while (sysread(STDIN, my $b, 65536)) { print $b }' 2>/dev/null)
            else
                IFS= read -r -d '' -t 3 RAW_INPUT
            fi
            [ $? -gt 128 ] && RAW_PARTIAL="1"
            if [ "$RAW_PARTIAL" = "1" ] && [ -z "$RAW_INPUT" ]; then
                {
                    echo ""
                    echo "[ FAIL ] Dev-OS Policy Violation (fail-closed fallback: hook parser unavailable, rc=$HELPER_RC)"
                    echo "         The hook payload could not be read before the timeout, so no gate could be checked."
                    echo "         Restore node and .agents/hooks/lib/hook-input.js, or ask the human to run the command."
                    echo ""
                } >&2
                exit 2
            fi
        fi
        if [ -n "$RAW_INPUT" ]; then
            if REASON=$(fallback_reason "$RAW_INPUT"); then
                {
                    echo ""
                    echo "[ FAIL ] Dev-OS Policy Violation (fail-closed fallback: hook parser unavailable, rc=$HELPER_RC)"
                    echo "         The input matches a protected pattern ($REASON) and could not be parsed precisely."
                    echo "         Restore node and .agents/hooks/lib/hook-input.js, or ask the human to run the command."
                    echo ""
                } >&2
                exit 2
            fi
        fi
        echo "[ WARN ] Dev-OS pre-tool-use: input parser unavailable (node or lib/hook-input.js missing or failed$( [ "$RAW_PARTIAL" = "1" ] && echo '; stdin read timed out' )); only the fallback checks ran." >&2
        # File tools (or a payload cut off before its tool_name): run the Design and
        # Orchestration Gates over the file_path, else over every path-like string.
        [ $# -eq 0 ] && [ -n "$RAW_INPUT" ] || exit 0
        FB_TOOL=$(printf '%s' "$RAW_INPUT" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')
        case "$FB_TOOL" in
            Edit|Write|MultiEdit|NotebookEdit) ;;
            "") printf '%s' "$RAW_INPUT" | grep -q '^[[:space:]]*{' || exit 0 ;;
            *) exit 0 ;;
        esac
        TOOL_NAME="$FB_TOOL"
        FALLBACK="1"
        ROOT="$CLAUDE_PROJECT_DIR"
        TARGETS=$(printf '%s' "$RAW_INPUT" | grep -oE '"(file_path|notebook_path)"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')
        if [ -z "$TARGETS" ]; then
            TARGETS=$(printf '%s' "$RAW_INPUT" \
                | grep -oE '[A-Za-z0-9_.~@%+/-]+\.(tsx|jsx|vue|svelte|html|css|ts|js|mjs|cjs|py|rb|go|rs|java|php|sql)([^A-Za-z0-9_]|$)' \
                | sed -E 's/[^A-Za-z0-9_]$//' | sort -u | head -n 200)
        fi
        [ -n "$TARGETS" ] || exit 0
        TARGETS="$TARGETS
"
        ;;
esac

if [ "$PARSE" = "empty" ]; then
    exit 0
fi

if [ -n "$ROOT" ]; then
    cd "$ROOT" 2>/dev/null || exit 0
fi

# What the telemetry and block messages describe: the command for Bash, the path for file tools.
SUBJECT="$COMMAND"
if [ -z "$SUBJECT" ]; then
    SUBJECT="$TOOL_NAME $(printf '%s' "$TARGETS" | head -n 1)"
fi

# Mask anything that looks like a credential before it reaches telemetry (Hard Rule 2).
redact() {
    printf '%s' "$1" | sed -E \
        -e 's/(AKIA|ASIA)[0-9A-Z]{16}/[REDACTED]/g' \
        -e 's/(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{20,}/[REDACTED]/g' \
        -e 's/github_pat_[0-9A-Za-z_]{20,}/[REDACTED]/g' \
        -e 's/sk-[0-9A-Za-z_-]{16,}/[REDACTED]/g' \
        -e 's/xox[baprs]-[0-9A-Za-z-]{10,}/[REDACTED]/g' \
        -e 's/([Bb]earer|[Tt]oken|[Pp]assword|[Ss]ecret|[Aa]pi[_-]?[Kk]ey)([=: ]+)[^ "'"'"']+/\1\2[REDACTED]/g' \
        -e 's#(://[^:/@ ]+:)[^@/ ]+@#\1[REDACTED]@#g'
}

LOG_TELEMETRY() {
    RULE="$1"
    DETAIL=$(redact "$2")
    if [ -f "bin/devos.js" ]; then
        node bin/devos.js telemetry log --type HOOK_VIOLATION --rule "$RULE" --detail "$DETAIL" --quiet >/dev/null 2>&1 && return 0
    elif command -v devos >/dev/null 2>&1; then
        devos telemetry log --type HOOK_VIOLATION --rule "$RULE" --detail "$DETAIL" --quiet >/dev/null 2>&1 && return 0
    fi

    if [ -f ".agents/manifest.json" ] && grep -Eq '"telemetry"[[:space:]]*:[[:space:]]*"off"' ".agents/manifest.json"; then
        return 0
    fi
    mkdir -p .agents/telemetry 2>/dev/null || return 0
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")
    CLEAN_DETAIL=$(printf '%s' "$DETAIL" | tr '"\\\n\r\t' '     ' | cut -c 1-200)
    echo "{\"timestamp\":\"$TIMESTAMP\",\"eventType\":\"HOOK_VIOLATION\",\"rule\":\"$RULE\",\"detail\":\"$CLEAN_DETAIL\"}" >> .agents/telemetry/events.jsonl 2>/dev/null
    return 0
}

# block <telemetry-rule> <message lines...>: print reason to stderr, log, exit 2.
block() {
    RULE="$1"
    shift
    {
        echo ""
        for msg in "$@"; do echo "$msg"; done
        echo ""
    } >&2
    LOG_TELEMETRY "$RULE" "$SUBJECT"
    exit 2
}

# A board only counts as having an active task if the [ IN_PROGRESS ] section body
# declares one with an Assignee. The section header or the DAG legend is not proof.
has_active_task() {
    [ -f "docs/TASK_BOARD.md" ] || return 1
    ACTIVE_BLOCK=$(awk '/^###[[:space:]]*\[[[:space:]]*IN_PROGRESS[[:space:]]*\]/{f=1;next} /^###[[:space:]]/{f=0} f' "docs/TASK_BOARD.md")
    printf '%s\n' "$ACTIVE_BLOCK" | grep -Eq 'Assignee:'
}

# 0. Self-approval guard: the model may not set the commit approval variables itself.
if [ "$APPROVAL_ENV" = "1" ]; then
    block "RULE_8_COMMIT_GATE" \
        "[ FAIL ] Dev-OS Policy Violation (Hard Rule 8: Mechanical Commit Gate)" \
        "         Assigning or exporting DEVOS_COMMIT_APPROVED, DEVOS_HEADLESS_COMMIT or DEVOS_AGENT_COMMIT inside a command is self-approval and is blocked." \
        "         Stop and present a summary for human review; the human commits via .agents/scripts/commit.sh."
fi

# 0b. Agent-shell markers (CLAUDECODE, GEMINI_CLI, ...) may not be removed around git or commit.sh.
if [ "$MARKER_TAMPER" = "1" ]; then
    block "RULE_8_COMMIT_GATE" \
        "[ FAIL ] Dev-OS Policy Violation (Hard Rule 8: Mechanical Commit Gate)" \
        "         Unsetting or overriding agent-shell markers (or clearing the environment) together with git or commit.sh is blocked." \
        "         Present your changes for human review; the human commits via .agents/scripts/commit.sh."
fi

# 0c. Gate state (TRIVIAL budget, session stamp, git hooks) is not writable by tool calls.
if [ -n "$PROTECTED" ]; then
    block "GATE_STATE_TAMPER" \
        "[ FAIL ] Dev-OS Policy Violation (gate state is read-only to agents)" \
        "         Writing, moving or deleting Dev-OS gate state is blocked ($PROTECTED)." \
        "         .git/devos-* holds the TRIVIAL budget and session stamp; .git/hooks/* holds the commit gate." \
        "         Ask the human if these really need to change."
fi

# 1. Destructive commands (Hard Rule 1)
if [ -n "$DESTRUCTIVE" ] && [ "$DEVOS_DESTRUCTIVE_APPROVED" != "true" ]; then
    block "RULE_1_ZERO_DESTRUCTIVE" \
        "[ FAIL ] Dev-OS Policy Violation (Hard Rule 1: Zero Destructive Actions)" \
        "         Destructive command blocked ($DESTRUCTIVE): $COMMAND" \
        "         You MUST formulate and present a dry-run plan to the human before executing." \
        "         To execute after human approval, the human exports DEVOS_DESTRUCTIVE_APPROVED=true."
fi

# 2. Raw git commit (Hard Rule 8)
if [ "$GIT_COMMIT" = "1" ] && [ "$DEVOS_COMMIT_APPROVED" != "true" ]; then
    block "RULE_8_COMMIT_GATE" \
        "[ FAIL ] Dev-OS Policy Violation (Hard Rule 8: Mechanical Commit Gate)" \
        "         Commit-creating git commands (commit, merge, cherry-pick, revert, am, commit-tree) are forbidden here." \
        "         Present your changes for human review; commits go through: .agents/scripts/commit.sh"
fi

# 2b. commit.sh must run as the literal command word ".agents/scripts/commit.sh" so the Claude Code
#     ask rule Bash(.agents/scripts/commit.sh *) matches and the human is asked to approve it.
if [ "$COMMIT_SH" = "noncanonical" ]; then
    block "RULE_8_COMMIT_GATE" \
        "[ FAIL ] Dev-OS Policy Violation (Hard Rule 8: Mechanical Commit Gate)" \
        "         commit.sh must be run exactly as: .agents/scripts/commit.sh ... (from the project root)." \
        "         Running it through bash/sh/source/eval, ./, an absolute path or a substitution is blocked," \
        "         because that spelling would skip the human approval prompt."
fi

# A canonical commit.sh call always goes to the human, even if the settings ask rule was removed.
# (Claude Code reads this JSON on exit 0; an explicit ask rule prompts in every permission mode.)
if [ "$COMMIT_SH" = "canonical" ] && [ $# -eq 0 ]; then
    printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Dev-OS: commits need your approval. Review the staged changes and the commit message before allowing."}}'
fi

# Gates 3-5 apply to files the tool call writes inside the project
# (Edit/Write/MultiEdit/NotebookEdit file_path, or Bash redirections/touch/tee/cp/mv/sed -i targets).
# UTARGETS are write targets the parser could not resolve (unknown variables); only the
# UI-extension check applies to them.
[ -n "$TARGETS" ] || [ -n "$UTARGETS" ] || exit 0

UI_RE='\.(tsx|jsx|vue|svelte|html|css)$'
UI_EXEMPT_RE='(^|/)(docs|\.agents)/|(^|/)DESIGN\.md$|(^|/)package\.json$|tailwind\.config|\.(test|spec|stories)\.'
CODE_RE='\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|php|vue|svelte|sql)$'
CODE_EXEMPT_RE='(^|/)(\.agents|docs|scripts|tests?|__tests__|node_modules)/|\.(test|spec|config)\.|\.d\.ts$|\.md$'

UI_HIT=""; CODE_HIT=""; BOARD_HIT=""
while IFS= read -r t; do
    [ -n "$t" ] || continue
    if [ -z "$UI_HIT" ] && printf '%s' "$t" | grep -Eq "$UI_RE" && ! printf '%s' "$t" | grep -Eq "$UI_EXEMPT_RE"; then
        UI_HIT="$t"
    fi
    if [ -z "$CODE_HIT" ] && printf '%s' "$t" | grep -Eq "$CODE_RE" && ! printf '%s' "$t" | grep -Eq "$CODE_EXEMPT_RE"; then
        CODE_HIT="$t"
    fi
    if [ -z "$BOARD_HIT" ] && [ "$t" != "docs/TASK_BOARD.md" ]; then
        BOARD_HIT="$t"
    fi
done <<EOF
$TARGETS
EOF
if [ -z "$UI_HIT" ] || [ "$FALLBACK" = "1" ]; then
    while IFS= read -r t; do
        [ -n "$t" ] || continue
        if [ -z "$UI_HIT" ] && printf '%s' "$t" | grep -Eq "$UI_RE" && ! printf '%s' "$t" | grep -Eq "$UI_EXEMPT_RE"; then
            UI_HIT="$t"
        fi
        # Unparsed input: unresolved paths count for the Orchestration Gate too.
        if [ "$FALLBACK" = "1" ] && [ -z "$CODE_HIT" ] && printf '%s' "$t" | grep -Eq "$CODE_RE" && ! printf '%s' "$t" | grep -Eq "$CODE_EXEMPT_RE"; then
            CODE_HIT="$t"
        fi
    done <<EOF
$UTARGETS
EOF
fi

# TRIVIAL fast path (see header). fast_path returns 0 when this Edit qualifies and charges
# its lines to the session budget once; otherwise FP_WHY says why it does not qualify.
TRIVIAL_MAX_LINES=30
TRIVIAL_MAX_BYTES=6000
FP_STATE=""; FP_WHY=""
FP_MANIFEST_RE='(^|/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|pnpm-workspace\.yaml|bun\.lockb?|composer\.(json|lock)|requirements[^/]*\.txt|pyproject\.toml|poetry\.lock|pipfile(\.lock)?|go\.(mod|sum)|cargo\.(toml|lock)|gemfile(\.lock)?)$'
FP_SCHEMA_RE='(^|/)(migrations?|schemas?|prisma)/|(^|/)schema\.[a-z]+$|\.(sql|prisma)$'
FP_AUTH_RE='auth|login|session|permission|policy|middleware'
fast_path() {
    if [ "$FP_STATE" = "ok" ]; then return 0; fi
    if [ "$FP_STATE" = "no" ]; then return 1; fi
    FP_STATE="no"
    if [ "$DEVOS_TRIVIAL_FASTPATH" = "off" ]; then FP_WHY="disabled (DEVOS_TRIVIAL_FASTPATH=off)"; return 1; fi
    if [ "$FALLBACK" = "1" ]; then FP_WHY="the hook payload could not be fully read or parsed"; return 1; fi
    if [ "$TOOL_NAME" != "Edit" ]; then FP_WHY="only the Edit tool qualifies ($TOOL_NAME does not)"; return 1; fi
    if [ "$EDIT_EXISTS" != "1" ] || [ -n "$UTARGETS" ]; then FP_WHY="the edit creates a new file or is not a plain string edit of an existing file"; return 1; fi
    case "$EDIT_LINES$EDIT_BYTES" in ''|*[!0-9]*) FP_WHY="edit size unknown"; return 1 ;; esac
    if [ "$EDIT_LINES" -ge "$TRIVIAL_MAX_LINES" ] || [ "$EDIT_BYTES" -ge "$TRIVIAL_MAX_BYTES" ]; then
        FP_WHY="the edit changes $EDIT_LINES lines / $EDIT_BYTES bytes (limit: under $TRIVIAL_MAX_LINES lines, $TRIVIAL_MAX_BYTES bytes)"; return 1
    fi
    FP_LOWER=$(printf '%s' "$TARGETS" | tr 'A-Z' 'a-z')
    if printf '%s' "$FP_LOWER" | grep -Eq "$FP_MANIFEST_RE"; then FP_WHY="dependency manifests and lockfiles never qualify"; return 1; fi
    if printf '%s' "$FP_LOWER" | grep -Eq "$FP_SCHEMA_RE"; then FP_WHY="schema and migration files never qualify"; return 1; fi
    if printf '%s' "$FP_LOWER" | grep -Eq "$FP_AUTH_RE"; then FP_WHY="auth/session/permission/policy/middleware paths never qualify"; return 1; fi
    FP_BUDGET=$(git rev-parse --git-path devos-trivial-budget 2>/dev/null)
    if [ -z "$FP_BUDGET" ] || [ ! -d "$(dirname "$FP_BUDGET")" ]; then FP_WHY="no git directory to track the session budget"; return 1; fi
    # Budget file: line 1 = lines used, line 2 = the session_id they were charged to. With a
    # session_id in the payload the budget resets only when the id changes; the stamp mtime
    # does not matter. Payloads without a session_id (manual runs) fall back to the session
    # stamp written by session-start.sh.
    FP_USED=0
    if [ -f "$FP_BUDGET" ]; then
        FP_OLD_USED=$(sed -n 1p "$FP_BUDGET" 2>/dev/null | tr -cd '0-9')
        FP_OLD_SID=$(sed -n 2p "$FP_BUDGET" 2>/dev/null)
        if [ -n "$SESSION_ID" ]; then
            [ "$FP_OLD_SID" = "$SESSION_ID" ] && FP_USED="${FP_OLD_USED:-0}"
        else
            FP_STAMP=$(git rev-parse --git-path devos-session-stamp 2>/dev/null)
            if ! { [ -n "$FP_STAMP" ] && [ "$FP_STAMP" -nt "$FP_BUDGET" ]; }; then FP_USED="${FP_OLD_USED:-0}"; fi
        fi
    fi
    FP_TOTAL=$((FP_USED + EDIT_LINES))
    if [ "$FP_TOTAL" -gt "$TRIVIAL_MAX_LINES" ]; then
        FP_WHY="the session's TRIVIAL budget is spent ($FP_USED lines used, this edit adds $EDIT_LINES; limit $TRIVIAL_MAX_LINES per session)"; return 1
    fi
    printf '%s\n%s\n' "$FP_TOTAL" "$SESSION_ID" > "$FP_BUDGET" 2>/dev/null || { FP_WHY="could not record the session budget"; return 1; }
    FP_STATE="ok"
    return 0
}
fp_note() {
    echo "         TRIVIAL fast path not applied: $FP_WHY."
}

# 3. Mandatory Design Gate (Hard Rule 15): DESIGN.md must exist at the project root.
if [ -n "$UI_HIT" ] && [ ! -f "DESIGN.md" ] && ! fast_path; then
    block "MANDATORY_DESIGN_GATE" \
        "[ FAIL ] Dev-OS Policy Violation (Mandatory Design Gate, Hard Rule 15)" \
        "         Cannot create or modify frontend file '$UI_HIT' without DESIGN.md at the project root." \
        "         Remediation:" \
        "           1. Invoke the UI Designer agent with skill 'anti-ai-ui' (required by Hard Rule 15)." \
        "           2. Extract design tokens and archetype matching this project." \
        "           3. Author DESIGN.md at the project root and obtain QA approval before writing UI components." \
        "$(fp_note)"
fi

# 4. Task Board Active Task Gate (optional strict mode: DEVOS_ENFORCE_TASK_BOARD=1).
# Applies to writes only; editing docs/TASK_BOARD.md itself is always allowed.
if [ "$DEVOS_ENFORCE_TASK_BOARD" = "1" ] && [ -f "docs/TASK_BOARD.md" ] && [ -n "$BOARD_HIT" ]; then
    if ! has_active_task; then
        block "TASK_BOARD_GATE" \
            "[ FAIL ] Dev-OS Policy Violation (Task Board State Gate)" \
            "         No active task under '### [ IN_PROGRESS ]' with an 'Assignee:' line in docs/TASK_BOARD.md." \
            "         Select or start a task first: devos task start <id>"
    fi
fi

# 5. Orchestration Gate / MREE (Hard Rule 23)
# Blocks solo production-code authoring when delegation is enforced and no active task
# with an assignee is declared. Escape hatch: DEVOS_SOLO_APPROVED=true.
if [ -n "$CODE_HIT" ]; then
    ORCH_ENFORCED="0"
    if [ "$DEVOS_ENFORCE_ORCHESTRATOR" = "1" ]; then ORCH_ENFORCED="1"; fi
    if [ -f ".agents/memory/session.json" ] && grep -Eq '"delegationRequired"[[:space:]]*:[[:space:]]*true' .agents/memory/session.json; then
        ORCH_ENFORCED="1"
    fi

    if [ "$ORCH_ENFORCED" = "1" ] && [ "$DEVOS_SOLO_APPROVED" != "true" ] && ! has_active_task && ! fast_path; then
        block "ORCHESTRATION_GATE" \
            "[ FAIL ] Dev-OS Policy Violation (Orchestration Gate / MREE, Hard Rule 23)" \
            "         Orchestrator delegation is enforced but no active task with an assignee is declared ('$CODE_HIT')." \
            "         Remediation:" \
            "           1. Declare the task under '### [ IN_PROGRESS ]' with an 'Assignee:' line in docs/TASK_BOARD.md." \
            "           2. Delegate implementation to the assigned specialist subagent." \
            "           3. For intentional solo work, the human exports DEVOS_SOLO_APPROVED=true." \
            "$(fp_note)"
    fi
fi

exit 0
