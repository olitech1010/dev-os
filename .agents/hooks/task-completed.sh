#!/bin/bash

# Dev-OS Runtime Hook: TaskCompleted
# Records every task closure, and optionally enforces a verification command before a task
# may be marked complete.
#
# Interface (verified 2026-11-06 against code.claude.com/docs/en/hooks, CLI 2.1.319):
#   Payload on stdin: {hook_event_name:"TaskCompleted", task_id, task_subject,
#                      task_description?, teammate_name?, team_name?, agent_id?, ...}
#   Fires when an agent marks a task complete through TaskUpdate, and when an agent-team
#   teammate ends its turn with tasks still in progress. No matcher support.
#   Blocking: exit 2 refuses the completion and feeds stderr back to the model. The
#   {"continue":false} form is ignored when TaskUpdate triggered the event, so exit 2 is the
#   only reliable refusal and the only one Dev-OS uses.
#
# Default behaviour is advisory: record the closure and exit 0. A hook that ran the test suite
# on every task closure would add minutes to each one and would block work the human never
# asked it to block, so enforcement is opt-in:
#   DEVOS_TASK_VERIFY="<command>"   run <command> at the project root; exit 2 if it fails.
#   DEVOS_TASK_VERIFY=1            same, resolving the project's own script from package.json
#                                  ("scripts.verify", else "scripts.test"); advisory when
#                                  neither exists, so it never guesses at a command.
# The log is .agents/memory/task-completions.log (untracked), capped at 500 lines.

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
TASK_ID=$(devos_hook_field "$HOOK_INPUT" task_id)
TASK_SUBJECT=$(devos_hook_field "$HOOK_INPUT" task_subject)
TEAMMATE=$(devos_hook_field "$HOOK_INPUT" teammate_name)
[ -n "$TASK_ID" ] || TASK_ID="(no id)"
[ -n "$TASK_SUBJECT" ] || TASK_SUBJECT="(no subject)"
[ -n "$TEAMMATE" ] || TEAMMATE="main"

cd "$(devos_project_root)" 2>/dev/null || exit 0
[ -d ".agents" ] || exit 0

LOG=".agents/memory/task-completions.log"
mkdir -p .agents/memory 2>/dev/null
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
printf '%s\t%s\t%s\t%s\n' "$TIMESTAMP" "$TASK_ID" "$TEAMMATE" "$TASK_SUBJECT" >> "$LOG" 2>/dev/null
# Keep the log bounded without rewriting it on every call.
LINES=$(wc -l < "$LOG" 2>/dev/null | tr -d ' ')
case "$LINES" in ''|*[!0-9]*) LINES=0 ;; esac
if [ "$LINES" -gt 600 ]; then
    tail -n 500 "$LOG" > "$LOG.tmp.$$" 2>/dev/null && mv "$LOG.tmp.$$" "$LOG" 2>/dev/null || rm -f "$LOG.tmp.$$" 2>/dev/null
fi

# Opt-in verification gate.
VERIFY="$DEVOS_TASK_VERIFY"
[ -n "$VERIFY" ] || exit 0
[ "$VERIFY" = "off" ] && exit 0
if [ "$VERIFY" = "1" ] || [ "$VERIFY" = "true" ] || [ "$VERIFY" = "yes" ]; then
    # Resolve the project's own script by PARSING package.json, not by grepping its text: a
    # dependency named "verify", or a nested tool config with a "test" key, would otherwise be
    # read as a script and this gate would refuse a task for a project that has no such script.
    VERIFY=""
    if [ -f "package.json" ] && command -v node >/dev/null 2>&1; then
        VERIFY=$(node -e '
            try {
                const s = (JSON.parse(require("fs").readFileSync("package.json", "utf8")).scripts) || {};
                if (typeof s.verify === "string" && s.verify.trim()) process.stdout.write("npm run verify");
                else if (typeof s.test === "string" && s.test.trim()) process.stdout.write("npm test");
            } catch (e) {}
        ' 2>/dev/null)
    fi
    # Nothing resolved (no package.json, no node, neither script): stay advisory rather than
    # guess at a command and refuse the task on the result.
    [ -n "$VERIFY" ] || exit 0
fi

VERIFY_OUT=$(eval "$VERIFY" 2>&1)
VERIFY_STATUS=$?
if [ "$VERIFY_STATUS" -ne 0 ]; then
    {
        echo "[ FAIL ] Dev-OS task completion gate (TaskCompleted): verification failed."
        echo "         Task: $TASK_SUBJECT ($TASK_ID)"
        echo "         Command: $VERIFY (exit $VERIFY_STATUS)"
        echo "         Last lines of its output:"
        printf '%s\n' "$VERIFY_OUT" | tail -n 20 | sed 's/^/           /'
        echo "         The task is NOT complete. Fix the failure, then mark it complete again."
        echo "         (This gate runs because DEVOS_TASK_VERIFY is set; unset it to make it advisory.)"
    } >&2
    exit 2
fi

exit 0
