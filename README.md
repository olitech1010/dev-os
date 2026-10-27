# Dev-OS

*A multi-agent engineering OS for AI coding assistants*

**by Clement Olives · Olives Technologies**

![Version](https://img.shields.io/badge/version-v5.1.1-blue.svg)
![npm](https://img.shields.io/badge/npm-%40olives%2Fdevos-red.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

```bash
npx @olives/devos init
```

Dev-OS installs a team of specialist agents, slash commands, skills and runtime gates into your project. You talk to an Orchestrator; it routes work to a Developer, QA, Tester, Security and the other specialists, and nothing reaches git history until a human commits it from their own terminal. The gates are mechanical: hook scripts and git hooks block the action, so they do not depend on the model remembering a rule. The CLI is a single zero-dependency Node script (`bin/devos.js`).

## Contents

1. [Quick start](#quick-start)
2. [Upgrading from 4.x](#upgrading-from-4x)
3. [Agent roster](#agent-roster)
4. [Commands](#commands)
5. [Workflows](#workflows)
6. [Gates and hooks](#gates-and-hooks)
7. [Skills and packs](#skills-and-packs)
8. [Multi-harness support](#multi-harness-support)
9. [Claude Code plugin](#claude-code-plugin)
10. [Memory and state files](#memory-and-state-files)
11. [Troubleshooting](#troubleshooting)
12. [Contributing and publishing](#contributing-and-publishing)

---

## Quick start

Requirements: Node.js 18 or later, Git, and Bash. Gitleaks is optional; without it the pre-commit hook falls back to a built-in secret scanner.

Run the installer from the root of your project:

```bash
npx @olives/devos init                                # interactive
npx @olives/devos init --existing --stack nextjs      # non-interactive, existing project
npx github:olitech1010/dev-os init                    # straight from GitHub
```

`init` makes no network calls by default (`DEVOS_OFFLINE=1` also skips every optional network step). Pass `--install-gitleaks` to install Gitleaks. With no `--harness`, configuration for every supported harness is written.

Verify the install:

```bash
npx @olives/devos doctor
```

The report ends with a summary like this, and `doctor` exits non-zero when a required check fails, so it can gate CI:

```
  [ PASS ] Claude Code hook wiring (.claude/settings.json PreToolUse)
  [ PASS ] Claude Code skills (.claude/skills/ in sync with .agents/skills/)
  [ WARN ] Mandatory Design Gate (DESIGN.md) (Missing)
  [ PASS ] Mechanical pre-commit hook (.git/hooks/pre-commit)
Diagnostic Summary: 12/12 required checks passed.
[ OK ] Dev-OS environment is fully operational.
```

Then open your assistant and describe the outcome, not the process. Dev-OS supplies the roles, gates and order of work:

```text
/auto Build an issue tracker for a five-person support team.
Features: inbox, assignment, SLA timers, weekly report
Integrations: Postgres, email login
Seed data: sample tickets documented in /docs
```

For a single change, a plain request or a command such as `/fix Login button does nothing on mobile Safari` is enough.

---

## Upgrading from 4.x

Run `devos update` (alias `upgrade`) in each project. It migrates a 4.x install in place.

**What changes**

- The roster shrinks to the agents listed below. `executive-proxy` merged into `orchestrator`, `sre` into `devops`, `release-manager` into `tech-writer`, and `memory-manager` duties moved to the `shared-memory` skill. Commands that still name an old agent route to its new owner.
- `telemetry` and `eval-engineer`, with `/telemetry` and `/eval`, moved to the opt-in maintainer pack.
- Merged skills are retired and their primaries installed. Old skill names resolve through the `aliases` map in `.agents/packs.json`, so `devos skill add git-commit` prints `[ WARN ] git-commit was merged into git-ops` and installs `git-ops`.
- Claude Code hooks move into `.claude/settings.json`. A legacy `.claude/hooks.json` that Dev-OS wrote is backed up and removed.
- Root `AGENTS.md` becomes the canonical instructions file. `.codex/instructions.md`, `OPENCODE.md`, `.opencode/opencode.json` and `.opencode/rules/devos-rules.md` are retired; OpenCode config moves to `opencode.json` at the project root.
- The git hook installer adds a `pre-merge-commit` hook.

**What is preserved**

- Retired agents and commands are removed only when Dev-OS generated them and nobody edited them. Edited files stay in place with a `[ WARN ]`.
- An edited `.claude/agents` or `.claude/commands` file, or a file of yours that shares a Dev-OS name, is kept.
- Customized skills are kept.
- Your own text outside the Dev-OS markers in managed files, your own hooks in `.agents/hooks/`, an existing `opencode.json` (Dev-OS merges into it), installed packs, and a recorded `--no-hooks` choice.

**Backups.** Every update copies `.agents/` to `.agents/_backup/<timestamp>/` first, and the migration copies every file it touches to `.agents/_backup/migration-<timestamp>/`.

**`--force`.** `devos update --force` regenerates edited agent and command files and overwrites customized skills, after backing them up. Use it only when you want the stock versions back.

The full list is in [CHANGELOG.md](CHANGELOG.md).

---

## Agent roster

Personas live in `.agents/agents/` and are generated into `.claude/agents/` with their own `tools` and `model` frontmatter, so reviewers and arbiters get narrower tool sets than builders. The default install currently has 13 agents:

| Agent | Role |
|---|---|
| `orchestrator` | Triages work (TRIVIAL, STANDARD, CRITICAL), delegates, runs the loop, keeps project memory through the `shared-memory` skill, and leads Autonomous Mode (`/auto`). Never writes production code or commits. |
| `architect` | Turns an idea into requirements with the `grill-me` skill and leads Spec-Driven Delivery. Does not write code. |
| `pm` | User stories, Given-When-Then acceptance criteria, MVP boundaries. |
| `ui-designer` | Owns the Design Gate: applies `anti-ai-ui` and a matched design system to produce `DESIGN.md`. |
| `developer` | Implements features and fixes. Presents staged changes for review and never commits. |
| `dba` | Schemas, migrations and RLS policies. Dry-run plan before anything destructive. |
| `tester` | Writes and runs tests from the spec. Reports failures, does not fix code. |
| `qa` | Runs lint, type-check, tests and scanners, then returns APPROVED or CHANGES REQUESTED. |
| `security` | OWASP, auth, input handling, secrets and dependency review, with severity-rated findings. |
| `researcher` | Confirms library versions, API signatures, CVEs and deprecations. Never writes code. |
| `devops` | CI/CD, infrastructure as code, SLOs, observability and incident runbooks. Plan and dry run before any change. |
| `tech-writer` | Docs, ADRs, semver, changelog and release notes. Sole owner of the Humanizer gate. |
| `tech-lead` | Read-only arbiter for the circuit breaker: one binding written decision, never a patch. |

**Maintainer pack** (`devos pack add maintainer`, sources in `.agents/maintainer/`), for people developing Dev-OS itself:

| Agent | Role |
|---|---|
| `telemetry` | Read-only root-cause analysis over `.agents/telemetry/events.jsonl`. Local event logging stays in the core `telemetry` skill. |
| `eval-engineer` | Capability eval suites, pass@k measurement and scorecards. |

---

## Commands

### Slash commands

Sources are in `.agents/commands/`; `devos init` and `devos update` generate `.claude/commands/` from them. Edit the sources, never the generated files.

| Command | Agent | Workflow | Use |
|---|---|---|---|
| `/auto <goal>` | orchestrator | autonomous-sdlc | Build an MVP or feature hands-off, with every gate intact |
| `/architect <idea>` | architect | inception | Requirements grilling into `docs/PROJECT_REQUIREMENTS.md` |
| `/spec <slug>` | architect | spec-driven | Requirements, design and tasks with three human checkpoints |
| `/pm <idea>` | pm | product-planning | User stories and acceptance criteria |
| `/design [keywords]` | ui-designer | standard | Match a brand design system and write `DESIGN.md` |
| `/redesign [scope]` | orchestrator | standard | Refactor existing UI to an updated `DESIGN.md` |
| `/fix <bug>` | developer | bugfix | Bug Fix Delivery |
| `/refactor <scope>` | developer | standard | Refactor with the QA gate |
| `/test <target>` | tester | direct | Write and run tests |
| `/review [path]` | qa | direct | QA review of current changes |
| `/secure [path]` | security | direct | Security scan of current changes |
| `/research <topic>` | researcher | direct | Library, API or topic research |
| `/commit [scope]` | developer | direct | Stage files and propose a message; the human runs the commit |
| `/deploy <env>` | devops | infrastructure | Deployment plan and checklist |
| `/sre <request>` | devops | infrastructure | IaC, SLOs and runbooks |
| `/tech-writer <scope>` | tech-writer | documentation | Docs and ADRs |
| `/humanize <path>` | tech-writer | documentation | Remove AI writing tells |
| `/tech-lead <context>` | tech-lead | arbitration | Break a deadlock or a tripped circuit breaker |
| `/status [focus]` | orchestrator | direct | Project state and task progress |
| `/task [list\|start\|done\|add]` | orchestrator | direct | Manage `docs/TASK_BOARD.md` |
| `/mode [mode]` | orchestrator | direct | Inspect or switch the locked session mode |
| `/skill [audit\|list\|sync\|...]` | devops | direct | Manage skills |

The maintainer pack adds `/eval` and `/telemetry`.

### CLI reference

Run `devos help` for the authoritative list. Every command also works as `npx @olives/devos <command>`.

| Command | Aliases | What it does |
|---|---|---|
| `init` | `setup` | Install Dev-OS into the current project |
| `update` | `upgrade` | Refresh `.agents/`, skills, commands, harness files and hooks; migrate 4.x |
| `doctor` | `check` | Diagnose setup, hooks, skill links, memory and task board |
| `status` | | One-screen summary of configuration and health |
| `list` | `agents` | Installed agents and skills |
| `run "<idea>"` | `auto` | Autonomous SDLC runner |
| `mode` | | `status`, `<interactive\|guided\|auto\|audit>`, `lock`, `unlock` |
| `commit-policy` | | `status`, `agent` (Claude Code default: the agent commits, you approve each one), `human`. See [Commit model](#commit-model) |
| `pack` | `packs` | `pack list`, `pack add <name>` |
| `skill` | `skills` | `list`, `add`, `update`, `sync`, `check`, `audit`, `find` |
| `spec waves <slug>` | | Print the parallel waves of `docs/specs/<slug>/tasks.md` |
| `spec check <slug>` | | Verify requirement coverage and task structure; exits 1 on gaps |
| `build-plugin` | | Build the Claude Code plugin (default `dist/claude-plugin/`) |
| `memory` | | `list`, `handoff`, `doctor` for the memory vault |
| `design` | | `list`, `match "<query>"`, `apply <id>`, `sync` for design systems |
| `scaffold` | | Recreate missing `CURRENT_STATE`, `TASK_BOARD`, `LESSONS` and `context.json` |
| `telemetry` | | Local failure telemetry: `status`, `enable`, `disable`, `report`, `export`, `clear`, and more |
| `eval` | `benchmark` | Capability evals and scorecards |
| `version` | | CLI, Node and environment info |

Common flags:

| Flag | Meaning |
|---|---|
| `-s, --stack <name>` | `nextjs`, `laravel`, `django`, `react-native`, `express`, `fastapi`, `universal` |
| `--harness <list>` | Comma list of `claude`, `cursor`, `opencode`, `antigravity`, `gemini`, `codex` |
| `-p, --platform <name>` | Older single-platform form; also accepts `all` |
| `--all-harnesses` | Write files for every harness |
| `-m, --mode <name>` | `interactive`, `guided`, `auto`, `audit` |
| `--fresh` / `--existing` | Non-interactive init |
| `--all-skills` | Install every skill instead of the stack packs |
| `--no-hooks` | Skip `.claude/settings.json` hooks and the git commit gate |
| `--no-claude` | Skip `.claude/` generation |
| `--install-gitleaks` | Install or upgrade Gitleaks through `install-hooks.sh` |
| `--commit-policy <p>` | `init`/`update`: set the commit policy (default `agent` with Claude Code, else `human`) |
| `-f, --force` | Overwrite customized files during update, after a backup |
| `--json` | JSON output for diagnostics, listings and `spec` |
| `--out <dir>`, `--print-path` | `build-plugin` output options |
| `-q, --quiet` | Suppress banners |

Value flags accept `--flag value` or `--flag=value`.

---

## Workflows

The full protocols are in `.agents/AGENTS.md` under Workflow Protocols. Each command's `workflow:` frontmatter maps to one of them.

**Standard Feature Delivery.** Orchestrator splits the task, Researcher confirms APIs and packages, Developer implements without committing, then QA, Tester and Security run in parallel. Any rejection routes back to the Developer under the circuit breaker. The human reviews and commits; DevOps deploys only with human approval. Production code needs an approved plan in `docs/plans/` or an approved `docs/specs/<slug>/tasks.md` (Hard Rule 22).

**Bug Fix Delivery.** Researcher reproduces and finds the root cause, Developer fixes, Tester writes the regression test first, QA approves, the human commits.

**TRIVIAL Fast Path.** A typo or small fix skips the plan gate, the task-board declaration and the parallel gate; the Developer runs a self-check (linter, type-checker, relevant tests, the scanner for the file type) and the human reviews. It qualifies only when the diff is under roughly 30 lines and touches no dependency, schema or migration, auth or secrets, or public API. The PreToolUse hook enforces this mechanically:

- Only an `Edit` to a file that already exists, with a non-empty `old_string`, qualifies. `Write`, `MultiEdit`, `NotebookEdit` and shell writes never do.
- The edit must be under 30 lines and 6000 bytes.
- Dependency manifests and lockfiles, schema, migration, `.sql` and Prisma files, and paths matching `auth|login|session|permission|policy|middleware` are excluded.
- A per-session budget of 30 changed lines is kept in the git directory as `devos-trivial-budget`. Once it is spent, the gates apply normally. Projects that are not git repositories get no fast path.
- A refused edit ends with `TRIVIAL fast path not applied: <reason>`. Set `DEVOS_TRIVIAL_FASTPATH=off` to disable the fast path.

**Spec-Driven Delivery** (`/spec`). For features that need written requirements. Everything lives in `docs/specs/<slug>/`, and init adds a template at `docs/specs/_template/`.

1. `requirements.md`: user stories and EARS criteria, one `### Rn: title` per requirement. Human checkpoint.
2. `design.md`: components, data model, interfaces, errors and testing, each tracing to R ids. Human checkpoint.
3. `tasks.md`: `### Tn: title` tasks, each with exactly one `depends:`, `covers:` and `verify:` line. Run `devos spec check <slug>` for coverage and `devos spec waves <slug>` for the parallel waves. Human checkpoint.

The approved `tasks.md` counts as the implementation plan. Tasks then go onto the task board wave by wave and each one runs through Standard Feature Delivery.

**Circuit breaker** (Hard Rule 10). One iteration is a Developer fix attempt plus the gate run that fails it. After three failed iterations on the same task the loop halts. The Tech Lead gets exactly one arbitration attempt: a written root-cause verdict and fix specification, applied by the Developer and checked by one more gate run. If that fails, or the requirement is ambiguous, work stops and goes to the human. With no Tech Lead (solo sessions) the trip goes straight to the human.

Other protocols in `.agents/AGENTS.md`: Project Inception, Product Planning, Documentation, Infrastructure, Autonomous SDLC, Rollback, Dependency Update and Exploratory Refactoring.

---

## Gates and hooks

### Claude Code hook events

`init` and `update` merge these into `.claude/settings.json` and keep your own settings and hooks. Each script reads Claude Code's JSON on stdin and blocks with exit code 2 and a reason on stderr.

| Event | Script | What it enforces |
|---|---|---|
| SessionStart | `session-start.sh` | Runs the freshness fetch, locks the session mode in `.agents/memory/session.json`, writes the session stamp. After compaction it re-injects the mode, active task, Hard Rules pointer and circuit breaker. |
| UserPromptSubmit | `user-prompt-submit.sh` | Re-asserts the Orchestrator role and locked mode every turn. |
| PreToolUse (`Bash\|Edit\|Write\|MultiEdit\|NotebookEdit`) | `pre-tool-use.sh` | Blocks destructive commands (`rm -rf`, destructive git, SQL `DROP`/`TRUNCATE`), raw commits, UI files without `DESIGN.md`, and solo production writes when delegation is required. Applies the TRIVIAL fast path. |
| PostToolUse (`Edit\|Write\|MultiEdit`) | `post-tool-use.sh` | Runs `ui-taste-check.sh`, `env-check.sh` or `db-check.sh` on the edited file and reports findings. The edit is not undone. Opt out: `DEVOS_POST_CHECKS=off`. |
| Stop | `stop.sh` | Asks for a `docs/CURRENT_STATE.md` update when tracked code changed. Opt out: `DEVOS_STOP_GATE=off`. |
| SubagentStop | `subagent-stop.sh` | A subagent that edited tracked code must leave a note in `.agents/memory/handoffs/`. Opt out: `DEVOS_HANDOFF_GATE=off`. |
| SessionEnd | `session-end.sh` | Prints a state reminder only; never blocks. |

`settings.json` also gets `permissions.deny` rules for `git commit`, `git push --force` and reading `.env` files.

### Commit model

Agents write code and stage it. Every commit needs a human approval, and you choose where that approval happens with `devos commit-policy`:

| Policy | Who runs the commit | How you approve |
|---|---|---|
| `human` (default without Claude Code) | You, with `.agents/scripts/commit.sh` in your own terminal | Type `approve`, the commit type and the message on `/dev/tty` |
| `agent` (default with Claude Code) | The agent, with `.agents/scripts/commit.sh --agent "<message>"`, when you ask for a commit | Claude Code shows you a permission prompt for that exact command |

```bash
devos commit-policy            # show the current policy
devos commit-policy agent      # the agent commits; you approve each commit in the prompt
devos commit-policy human      # only you commit, from your own terminal
```

In practice: the agent finishes the work and shows you a summary. You say "commit it". The agent runs the commit, and Claude Code asks you to approve that exact command and message. `git push` works the same way. You never open another terminal.

Why the `agent` policy is safe:

- The approval comes through a channel the agent cannot write to. Dev-OS adds the ask rule `Bash(.agents/scripts/commit.sh *)` to `.claude/settings.json`. Explicit ask rules prompt in every permission mode, including auto mode and `bypassPermissions`, and an allow rule cannot override them.
- Permission rules match the command text, so the PreToolUse hook blocks every other way of running the script: `bash commit.sh`, `./`, an absolute path, `source`, `eval`, and substitutions. It also blocks assigning `DEVOS_AGENT_COMMIT` or `DEVOS_COMMIT_APPROVED` inline.
- `commit.sh --agent` checks the policy, that the shell is Claude Code, that the ask rule is present, and that it was invoked as `.agents/scripts/commit.sh` from the project root. The pre-commit hook re-checks the policy and the harness.
- Codex, Gemini CLI and Cursor stay human-only, because they have no equivalent prompt that holds in every mode.

Other rules:

- Outside the `agent` policy, agent shells can never commit. `commit.sh`, the git `pre-commit` hook and the `pre-merge-commit` hook all refuse when an agent-shell variable is set (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `GEMINI_CLI`, `CODEX_SANDBOX`, `CODEX_SANDBOX_NETWORK_DISABLED`, `CODEX_THREAD_ID`, `CURSOR_AGENT`, `AI_AGENT`). Exporting `DEVOS_COMMIT_APPROVED=true` does not get around this.
- A raw `git commit` without `commit.sh` is refused by the pre-commit hook.
- Headless commits are for CI only: `DEVOS_HEADLESS_COMMIT=1 .agents/scripts/commit.sh "<type>: <subject>"` works only with `CI=true`.
- The pre-commit hook then runs Gitleaks (or the built-in scanner), `env-check.sh`, and, for matching staged files, `db-check.sh`, `ui-taste-check.sh` and `humanize-check.sh`.

`/commit` stages and proposes a message. It runs the commit only under the `agent` policy, and then only through the permission prompt. Git hooks are not version-controlled, so after upgrading run `devos update` or `.agents/scripts/install-hooks.sh` to refresh them. Details: [templates/docs/PRE_COMMIT_HOOK.md](templates/docs/PRE_COMMIT_HOOK.md), installed into fresh projects as `docs/PRE_COMMIT_HOOK.md`.

### Known limits

- The PreToolUse hook is a guard, not a sandbox. It parses command text, so `bash script.sh`, `python -c ...` and other interpreters running a file or string are not inspected. The git hooks and `commit.sh` are the backstop for commits; nothing backstops an arbitrary destructive script.
- The `DEVOS_COMMIT_APPROVED` token stops accidental raw commits by humans. It is not a security boundary against a human, who can export it by hand.
- Runtime hooks are wired for Claude Code only. In other harnesses the rules arrive as instructions, and `commit.sh` plus the git hooks are the enforced part.
- Escape hatches exist for humans (`DEVOS_DESTRUCTIVE_APPROVED`, `DEVOS_SOLO_APPROVED` and the opt-outs above). They are read from the hook's environment, never from command text.

---

## Skills and packs

Skills live in `.agents/skills/<name>/SKILL.md` and are grouped into packs in `.agents/packs.json`. `init` installs the `core` pack plus the pack for your stack; `--all-skills` installs everything. The repository currently ships 53 skills.

| Kind | Packs |
|---|---|
| Core (always installed) | `core`: brainstorming, writing-plans, spec-driven, grill-me, autonomous-sdlc, humanizer, anti-ai-ui, task-board, shared-memory, git-ops, code-reviewer, qa, security-review, telemetry and others |
| Stack | `nextjs`, `laravel`, `python`, `mobile` |
| Optional | `agentic`, `creative`, `design-data`, `codex`, `google-adk`, `growth`, `web-tools` |
| Maintainer | `maintainer`: the telemetry and eval-engineer agents, `/eval`, `/telemetry`, and the `eval-harness` and `workflow-metrics` skills |

```bash
devos pack list               # packs with their skills, agents and commands
devos pack add design-data
devos skill add <name>        # merged 4.x names resolve through aliases
devos skill audit             # broken references, weak descriptions, unpinned npx, oversized SKILL.md
```

**Aliases.** The `aliases` map in `packs.json` keeps 4.x skill names working. For example `git-commit` and `git-workflow` resolve to `git-ops`, `design` and `web-design-guidelines` to `anti-ai-ui`, and `backend-patterns` to `backend-dev-guidelines`. A merged skill's content lives under its primary's `references/<old-name>/GUIDE.md`.

---

## Multi-harness support

Root `AGENTS.md` is the canonical cross-harness file. Dev-OS owns the block between its markers and regenerates it on update; keep your own notes outside the markers. The per-harness files are thin pointers that keep a Hard Rules digest.

| Harness | Files Dev-OS writes | How the rules load |
|---|---|---|
| Claude Code | `CLAUDE.md`, `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, `.claude/settings.json` | `CLAUDE.md` imports `@AGENTS.md`; hooks run from `settings.json` |
| Codex | `AGENTS.md` | Codex reads `AGENTS.md` directly |
| Windsurf (`codex` target) | `.windsurfrules` | Points at `AGENTS.md` |
| Cursor | `.cursor/rules/devos.mdc`, `.cursorrules` | Cursor reads `AGENTS.md`; the rule has `alwaysApply: true` |
| OpenCode | `opencode.json` at the project root | `"instructions": [".agents/AGENTS.md"]`, merged into an existing file |
| Gemini CLI | `GEMINI.md` | Imports `@./AGENTS.md` |
| Google Antigravity | `ANTIGRAVITY.md` | Pointer to `AGENTS.md` |

`.codex/instructions.md` and `OPENCODE.md` are retired. `devos update` removes them only when Dev-OS generated them, after a backup.

**Claude Code skills.** Every installed skill gets `.claude/skills/<name>`, a relative symlink to `../../.agents/skills/<name>`. On Windows, or when a symlink cannot be created, the skill is copied and its hash recorded. A real directory of yours at that path is never replaced, and `devos doctor` reports missing, broken or stale links.

---

## Claude Code plugin

Dev-OS also ships as a Claude Code plugin with the default agents, the commands, the core skills and the lifecycle hooks:

```text
/plugin marketplace add olitech1010/dev-os
/plugin install devos@olives-devos
```

This needs `@olives/devos` 5.1.1 published to npm, because the marketplace entry in `.claude-plugin/marketplace.json` uses a `command` source that builds the pinned version on your machine. That source type needs Claude Code v2.1.229 or later. The install shows you the build command and asks you to accept it before running anything, and Claude Code re-runs it once per session (the pinned version is cached under `~/.devos/claude-plugin/`). The plugin's hooks only act in projects that have been set up with `devos init` (they look for `.agents/manifest.json`); in any other repository they do nothing. To build the plugin locally instead:

```bash
devos build-plugin --out dist/claude-plugin
claude --plugin-dir dist/claude-plugin
```

Two cautions:

- **Do not enable the plugin in a project that already has the Dev-OS hooks wired in `.claude/settings.json`.** Every gate would run twice.
- Plugin agents ignore `permissionMode`, `hooks` and `mcpServers`, and a plugin cannot add permission rules or git hooks. `npx @olives/devos init` stays the primary install; the plugin suits trying Dev-OS out or using it where a project install is not possible.

---

## Memory and state files

| File | Owner | Purpose |
|---|---|---|
| `docs/CURRENT_STATE.md` | Orchestrator | Active task, status and branch. Must be updated before a session that changed code ends (Hard Rule 13; the Stop hook checks it). |
| `docs/LESSONS.md` | Orchestrator | Incidents, root causes and fixes. Agents read it before working in a domain. |
| `docs/TASK_BOARD.md` | Orchestrator | Task DAG. In `guided` and `auto` mode, solo production writes need an `[ IN_PROGRESS ]` task with an `Assignee:`. |
| `.agents/memory/session.json` | Hooks | Locked mode for the session. Change it with `devos mode <mode>`. |
| `.agents/memory/decisions/` | Agents | ADRs |
| `.agents/memory/handoffs/` | Subagents | Handoff notes; the SubagentStop hook requires one after code changes |
| `.agents/memory/context.json` | Orchestrator | Compact project context |
| `.agents/manifest.json` | CLI | Installed version, packs, harnesses, hooks choice, and a sha256 for each generated file |
| `.agents/telemetry/events.jsonl` | `telemetry` skill | Local failure log; no secrets |

Run `devos scaffold` to recreate missing state files, and `devos memory doctor` to check the vault.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `[ FAIL ]` "Direct 'git commit' is disabled" | Raw `git commit` | Run `.agents/scripts/commit.sh` from your own terminal |
| `commit.sh` refuses in an agent session | An agent-shell variable is set | Expected. Commit from a separate terminal |
| Secret scan blocks the commit | A key is staged | Remove it, read it from `process.env`, and revoke the key with the provider |
| UI edit blocked by the Design Gate | No `DESIGN.md` at the project root | Run `/design`, or let the UI Designer write it |
| Code edit blocked by the Orchestration Gate | `guided` or `auto` mode with no active task | Declare an `[ IN_PROGRESS ]` task with an `Assignee:` in `docs/TASK_BOARD.md`, or switch with `devos mode interactive` |
| A small edit was not fast-pathed | One of the TRIVIAL limits failed | Read the reason after `TRIVIAL fast path not applied:` |
| Claude keeps working when it tries to stop | Stop hook wants `docs/CURRENT_STATE.md` updated after code changes | Update it, or set `DEVOS_STOP_GATE=off` |
| `doctor` warns about skill links | `.claude/skills/` drifted | `devos skill sync` or `devos update` |
| Hooks seem to run twice | Plugin enabled on top of a project install | Disable the plugin |
| An edited agent or command was not updated | Dev-OS keeps edited files | `devos update --force` (backs up first) |
| Gitleaks not found | Not installed | `devos init --install-gitleaks`, or rely on the built-in scanner |

---

## Contributing and publishing

This repository is the Dev-OS source. Edit `.agents/` sources, never generated `.claude/` output, and keep `bin/devos.js` free of dependencies. Read `.agents/AGENTS.md` before changing workflows. First-party files use no emojis and report status with `[ OK ]`, `[ WARN ]` and `[ FAIL ]`.

```bash
npm test                 # smoke test (scripts/smoke-test.js)
npm run eval             # eval runner (scripts/eval-runner.js)
npm run build:plugin     # devos build-plugin
.agents/scripts/humanize-check.sh README.md
```

Publishing to npm (maintainers):

```bash
npm pack --dry-run       # inspect the tarball
npm publish              # prepublishOnly runs the smoke test
```

After publishing a new version, update the pinned version in `.claude-plugin/marketplace.json`.

Further reading, installed into fresh projects under `docs/`: [Getting Started](templates/docs/GETTING_STARTED.md), [Tutorial](templates/docs/TUTORIAL.md), [Architecture](templates/docs/ARCHITECTURE.md), [Slash Commands](templates/docs/SLASH_COMMANDS.md).

## License

[MIT](LICENSE). Copyright (c) 2026 Clement Olives, Olives Technologies.

Dev-OS bundles skills adapted from third-party open-source projects. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists each one with its upstream source and license.
