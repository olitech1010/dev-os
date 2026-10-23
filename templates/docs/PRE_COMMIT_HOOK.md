# Mechanical Pre-Commit Hook Reference

> Reference for the Git hooks written by `.agents/scripts/install-hooks.sh`: `pre-commit` and `pre-merge-commit`. This file describes behaviour as it ships today, plus the known limits that follow from it.

The commit gate has two halves. `.agents/scripts/commit.sh` collects human approval on the terminal and sets the approval token for one `git commit`. The `pre-commit` hook is what physically stops a commit: it refuses agent shells, refuses commits that did not come through `commit.sh`, and runs the secret, environment, database, UI, and documentation scans. The `pre-merge-commit` hook closes the gap that merge commits skip `pre-commit`.

---

## 1. Who Can Commit

| Caller | Result |
|---|---|
| AI agent shell (any agent marker set) | Refused by `commit.sh`, by `pre-commit`, and by `pre-merge-commit`, even with `DEVOS_COMMIT_APPROVED=true` |
| Human, raw `git commit` | Refused by `pre-commit` (no approval token) |
| Human, `.agents/scripts/commit.sh` in their own terminal | Allowed after typing `approve`, a commit type, and a message; then the scans run |
| CI pipeline, `DEVOS_HEADLESS_COMMIT=1` with `CI=true` | Allowed with a Conventional Commit message argument; the scans run |
| Human, merge commit | Allowed (`pre-merge-commit` only refuses agent shells) |

**Agent markers.** The hooks and `commit.sh` treat the shell as an agent shell when any of these environment variables is non-empty: `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `GEMINI_CLI`, `CODEX_SANDBOX`, `CODEX_SANDBOX_NETWORK_DISABLED`, `CODEX_THREAD_ID`, `CURSOR_AGENT`, `AI_AGENT`. The same list lives in `commit.sh`, the generated hooks, and `.agents/hooks/lib/hook-input.js`; keep them in sync.

An agent that finishes a change stages it, presents a summary, and asks the human to run `.agents/scripts/commit.sh` from their own terminal.

---

## 2. Installation

```bash
./.agents/scripts/install-hooks.sh
```

`devos init` runs the installer when lifecycle hooks are enabled and the project is a Git repository, and `devos update` runs it again. `devos doctor` reports a missing `.git/hooks/pre-commit` as a `[ WARN ]`.

**Existing projects must re-install.** Hook files in `.git/hooks/` are not version-controlled, so pulling a newer Dev-OS does not change them. After upgrading, re-run `./.agents/scripts/install-hooks.sh` (or `devos update`) to get the agent-shell refusal and the `pre-merge-commit` hook.

The installer:

1. Resolves the repository root with `git rev-parse --show-toplevel`, and exits `1` with `[ FAIL ]` outside a Git repository.
2. Creates `.git/hooks/` if needed.
3. Detects Gitleaks on `PATH` or at `.agents/bin/gitleaks`. It installs or upgrades Gitleaks only with `DEVOS_INSTALL_GITLEAKS=1` (`devos init --install-gitleaks`), and never touches the network with `DEVOS_OFFLINE=1`. The standalone download is checked against a pinned sha256 and the release's checksum file, and `.agents/bin/` is added to `.gitignore`.
4. Backs up an existing `pre-commit` hook that does not contain `DEVOS_COMMIT_APPROVED` to `.git/hooks/pre-commit.backup.<YYYYMMDDHHMMSS>`, then writes the Dev-OS hook. A hook that already contains the marker is overwritten in place.
5. Backs up an existing `pre-merge-commit` hook that does not contain `Dev-OS` the same way, then writes the Dev-OS hook.
6. Writes both hooks from quoted heredocs, so every variable is evaluated when the hook runs, and marks them executable.

---

## 3. What `pre-commit` Does

The hook `cd`s to the repository root and runs these checks in order. Any failure prints `[ FAIL ]` and exits `1`.

```
git commit
   │
   ▼
.git/hooks/pre-commit
   ├── 0. Agent shell?  any agent marker set        → [ FAIL ]
   ├── 1. Approval token: DEVOS_COMMIT_APPROVED != "true" → [ FAIL ] ("Direct 'git commit' is disabled")
   ├── 2. Secret scan: Gitleaks (git --staged --redact) or the built-in regex scanner
   ├── 3. env-check.sh          (always, when the script is present)
   ├── 4. db-check.sh           (when *.sql files are staged)
   ├── 5. ui-taste-check.sh     (when .tsx/.jsx/.vue/.svelte/.html files are staged)
   └── 6. humanize-check.sh     (on each staged docs/*.md file)
   │
   ▼
[ OK ] Dev-OS pre-commit checks passed.  exit 0
```

### Check 0: agent shells

Runs before the token check, so exporting `DEVOS_COMMIT_APPROVED=true` from an agent shell does not help. This is the mechanical form of Hard Rule 8.

### Check 1: the approval token

`commit.sh` sets `DEVOS_COMMIT_APPROVED=true` only on its own `git commit` call, after the checks in section 4. The variable does not leak into the user's shell.

The token is a policy control for humans, not a security boundary: a human can still export it by hand. What it prevents is the accidental raw `git commit`. Against agents, check 0 is the boundary.

### Check 2: secret scanning

With Gitleaks available, the hook runs `gitleaks git --staged --redact --verbose`; `--redact` keeps any detected value out of terminal and CI logs. Without Gitleaks, a built-in scanner checks the staged diff for AWS access keys, GitHub tokens, OpenAI and Anthropic keys, Google API keys, Slack tokens, and PEM private keys. Secret scanning is never skipped.

### Checks 3 to 6: Dev-OS scanners

Each runs only when its script exists and is executable under `.agents/scripts/`, and only for the staged file types listed above.

---

## 4. What `commit.sh` Checks

- **Agent shell.** Refuses when any agent marker is set, in both modes.
- **Headless mode.** `DEVOS_HEADLESS_COMMIT=1` (or `true`) is honoured only with `CI=true`. The message comes from the first argument and must be a Conventional Commit (`<type>[(scope)][!]: <subject>`). Use this in pipelines only.
- **Staged changes.** Refuses when nothing is staged. The script does not stage files; run `git add` first.
- **Interactive mode.** Needs a real controlling terminal. The `approve` token, the commit type, and the message are read from `/dev/tty`, so piped stdin cannot answer them.
- It does not run tests or QA; those gates happen before the human reaches this step.

---

## 5. What `pre-merge-commit` Does

Git skips `pre-commit` for merge commits, so a merge could otherwise bypass the agent check. The `pre-merge-commit` hook refuses when any agent marker is set and tells the agent to ask the human to merge. It does not require the approval token, so humans merge normally.

---

## 6. Known Issues

### Issue 1: legacy Gitleaks subcommand (resolved in v2.1.0)

Older hooks ran `gitleaks protect --staged --verbose`. `protect` is gone from the command list in Gitleaks 8.30.1+, so the hook now runs `gitleaks git --staged`.

### Issue 2: fragile `$?` testing (hardened in v2.1.0)

Testing `$?` on a later line breaks when someone inserts a log line. The hook tests the command directly with `if ! gitleaks ...; then`.

---

## 7. Verifying the Gate Yourself

In a scratch repository, from your own terminal (not an agent shell, or check 0 fires first):

```bash
git init /tmp/hook-check && cd /tmp/hook-check
/path/to/dev-os/.agents/scripts/install-hooks.sh

# Check 1: blocked with [ FAIL ], exit 1.
git commit --allow-empty -m "should be blocked"

# Check 2: blocked by the secret scan.
printf 'AWS_KEY = "AKIAIMNOJVGFDXXXE4OA"\n' > leak.txt
git add leak.txt
DEVOS_COMMIT_APPROVED=true git commit -m "should also be blocked"

# Check 0: blocked even with the token.
CLAUDECODE=1 DEVOS_COMMIT_APPROVED=true git commit --allow-empty -m "agent shell"

git log --oneline   # expect no commits
```

---

## 8. Related Documentation

- [System Architecture](ARCHITECTURE.md): the Commit Gate Flow diagram
- [Getting Started](GETTING_STARTED.md): installation and the scripted checkpoint
- [Lessons Learned](LESSONS.md): the incident that motivated the mechanical gate
- [Root README](../README.md): commit gate overview and setup steps
