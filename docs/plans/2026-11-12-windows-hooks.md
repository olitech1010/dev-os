# Plan: make the hook layer run on Windows (v5.3.0)

Status: APPROVED by the human on 2026-11-13 ("recommend n proceed" — both open questions
settled on my recommendation: fail open when no shell exists, and ship this before the guide
work). Raised as a live break by the human on 2026-11-12:
"i run devos on windows and did not work because i had to change .agents/hooks.json to
.agents/hooks.json.bak before. so we have to make the prehook a crossplatform so it can work
on windows too. and because it runs before any other tool usage, it can block any work to be
done when devos is installed."

## What is actually broken (read in the tree on 2026-11-12)

There is no Windows handling anywhere in the hook layer. `grep win32 bin/devos.js` returns
five hits, all of them printing the platform in a report or choosing copies over symlinks for
skills. The hook scripts and every harness config assume a POSIX shell.

Two separate failures, both on every tool call:

1. **Claude Code.** `bin/devos.js:2458` wires
   `"$CLAUDE_PROJECT_DIR"/.agents/hooks/pre-tool-use.sh`. That is a path to a `#!/bin/bash`
   file. A shebang is a kernel feature; `cmd.exe` and PowerShell do not honour it and cannot
   execute a `.sh` file as a command.
2. **Codex, Cursor, Antigravity, OpenCode.** `harnessHookCommand()` at `bin/devos.js:1992`
   emits
   `sh -c 'r=$(git rev-parse --show-toplevel 2>/dev/null || pwd); DEVOS_HOOK_FORMAT=<h> exec "$r/.agents/hooks/<script>"'`.
   This needs `sh` on PATH and POSIX single-quote semantics. Neither holds in `cmd.exe`.

What happens after the command fails is per harness, and this is why the human saw everything
blocked rather than a warning:

- Cursor: Dev-OS sets `failClosed: true` on `preToolUse`, so a hook that cannot run denies.
- Antigravity: the adapter is built around a required `{"decision": ...}`; no output is not an
  allow.
- Claude Code: exit 2 blocks, other non-zero codes surface as a non-blocking error, so it
  degrades to noise rather than a wall.

So the gate that exists to stop destructive commands instead stops everything, and the only
way out the human found was renaming the config. There is also no supported way back: `--no-hooks`
skips *writing* hooks (`bin/devos.js:3413`) but nothing unwires entries already in
`.claude/settings.json`, which is why renaming a file was the available move.

## Goal

Dev-OS installs and runs on Windows with the same gates, and on a machine where the gates
cannot run it says so and gets out of the way instead of blocking every tool call.

## Decisions

1. **One Node launcher, not per-harness shell strings.** Add `.agents/hooks/run.js`. Every
   harness config calls `node "<root>/.agents/hooks/run.js" <script> <format>`. Node is the one
   runtime guaranteed present: Dev-OS is a Node CLI, so a machine that can run `devos` can run
   the launcher. This replaces both broken command forms with one that is already portable,
   and it collapses two spellings into one.
2. **The launcher finds a POSIX shell rather than assuming one.** In order: `$DEVOS_SHELL`,
   `bash` then `sh` on PATH, and on Windows the Git for Windows shells at their install paths
   (`%ProgramFiles%\Git\bin\bash.exe`, `...\usr\bin\bash.exe`, and the `PROGRAMFILES(X86)`
   variants). Git for Windows ships bash and is present on essentially every Windows machine
   with git, which is every machine that can use Dev-OS, so this recovers real enforcement for
   almost all Windows users rather than merely unblocking them.
3. **No shell found means fail open, loudly.** The launcher prints one line to stderr naming
   the problem and exits 0. A gate that blocks 100% of legitimate work does not get fixed, it
   gets uninstalled, and the human already had to do exactly that. Failing open is the lesser
   harm, and it is only reached on a machine with no bash at all.
   **This is a deliberate weakening of enforcement on that machine, and the human should say
   if they would rather it kept blocking.**
4. **`devos doctor` reports it.** Shell found or not, which shell, and whether the gates are
   therefore active. A silent fail-open is how people ship with no gates and never learn.
5. **A real off switch.** `devos hooks off` unwires Dev-OS entries from every harness config it
   wrote, `devos hooks on` puts them back. Dev-OS owns the entries it writes (the
   `DEVOS_HOOK_MARKER` at `bin/devos.js:2456` already identifies them), so removal is precise
   and leaves other people's hooks alone. Renaming a config by hand stops being the escape.
6. **Paths, not just shells.** The scripts receive the project root from the launcher, which
   converts a Windows path to the form the chosen shell expects (Git Bash wants `/c/...`), so
   `"$r/.agents/hooks/..."` resolves inside the script.
7. **The `.sh` scripts stay the implementation.** Porting twelve gates to JavaScript is a much
   larger change with its own risk, and it would fork the behaviour across platforms. One
   launcher in front of the existing, tested scripts keeps a single implementation.

## Non-goals

- Rewriting the hooks in Node. Noted as the follow-up if Windows users turn out to lack bash.
- PowerShell-native gates.
- Changing what any gate decides. Behaviour is identical wherever a shell is found.

## Phases

TDD throughout, assertions first. The suite runs on macOS, so Windows paths are tested by
faking `process.platform` and the filesystem probe rather than by needing a Windows box; the
launcher's shell resolution is a pure function over (platform, PATH, existsSync) so it can be
tested directly.

### H1 — The launcher

- `.agents/hooks/run.js`: resolve root, resolve shell, convert the path, spawn, pipe stdin
  through, proxy stdout/stderr and the exit code.
- `resolveHookShell(platform, env, exists)` exported and tested against: POSIX with bash;
  POSIX with only sh; win32 with Git Bash present; win32 with nothing; `DEVOS_SHELL` set.
- Tests: a hook that exits 2 still exits 2 through the launcher; stdin reaches the script
  intact; no shell gives exit 0 plus one stderr line.

### H2 — Every harness config goes through it

- `harnessHookCommand()` and `DEVOS_CLAUDE_HOOKS` both emit the `node` form.
- Tests: no generated config contains `sh -c` or a bare `.sh` path; all five harnesses and the
  plugin agree; the conformance checker still passes.

### H3 — Visibility and the off switch

- `devos doctor` rows for shell and gate status; `devos hooks on|off|status`.
- Tests: `hooks off` removes only Dev-OS entries from a settings file holding a foreign hook;
  `hooks on` restores them; doctor reports a missing shell.

### H4 — Docs

- `templates/docs/PRE_COMMIT_HOOK.md` and the README gain a Windows section.
- CHANGELOG, and the 5.3.0 bump shared with the guide work.

## Risks

- **Spawn overhead.** The launcher adds a Node start to every tool call. Node starts in tens of
  milliseconds; the hook already spawns a shell. H1 measures it and records the number rather
  than assuming it is fine.
- **Fail-open is a real reduction.** Mitigated by the doctor row and the stderr line, and
  flagged above for the human to overrule.
- **Git Bash path drift.** If none of the probed paths exist, the result is fail-open, not a
  crash.

## Settled (2026-11-13, my recommendation, accepted)

1. **Fail open when no shell exists.** A gate that blocks every legitimate tool call does not
   get fixed, it gets removed, which is what already happened here. The reduction is real and
   bounded: it is reached only on a machine with no bash at all, and both the stderr line and
   the `devos doctor` row say the gates are inactive.
2. **Windows ships before the guide.** The break is live for anyone installing from GitHub
   today. The guide's remaining phases are the freshness gate and the wiring, not the page.
