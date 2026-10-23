# Dev-OS hook shared helpers. Sourced (not executed) by every hook in .agents/hooks/.
# bash 3.2 compatible, no external dependencies beyond coreutils and git.

# devos_plugin_gate: when the hooks run from a user-scope Claude Code plugin they fire in
# every project, so they must stand down outside Dev-OS projects.
# Contract: the plugin's hooks.json sets DEVOS_PLUGIN_MODE=1 for each hook command. With it
# set and no .agents/manifest.json at the project root, the calling hook drains stdin and
# exits 0 with no side effects. Without DEVOS_PLUGIN_MODE=1 this is a no-op.
# Project root: $CLAUDE_PROJECT_DIR, else the git top level of the working directory, else
# the working directory.
devos_plugin_gate() {
    [ "$DEVOS_PLUGIN_MODE" = "1" ] || return 0
    _devos_root="$CLAUDE_PROJECT_DIR"
    if [ -z "$_devos_root" ] || [ ! -d "$_devos_root" ]; then
        _devos_root=$(git rev-parse --show-toplevel 2>/dev/null) || _devos_root=""
        [ -n "$_devos_root" ] || _devos_root=$(pwd)
    fi
    [ -f "$_devos_root/.agents/manifest.json" ] && return 0
    # Not a Dev-OS project: drain the payload so the writer never sees EPIPE, then stand down.
    # The drain runs detached so an open, never-closed stdin cannot hold the hook.
    if [ ! -t 0 ]; then
        cat <&0 >/dev/null 2>&1 &
    fi
    exit 0
}
