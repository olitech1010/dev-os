# Changelog

All notable changes to Dev-OS are recorded here. The Tech Writer agent maintains this file.
Versions follow [Semantic Versioning](https://semver.org/).

## [5.1.2] - 2026-10-27

Completes the licensing audit. The four skills left unresolved in 5.1.1 were
traced to their origins: three are attributed, two are confirmed first-party.
The "Unresolved" table is now empty.

### Fixed

- `git-ops/references/git-commit` attributed to `github/awesome-copilot`
  (MIT, Copyright GitHub, Inc.). The as-vendored copy was byte-identical to
  upstream commit `e24be77e`; the current file differs by 40 lines, all of them
  the Dev-OS commit-gate rerouting. Its `license: MIT` frontmatter was upstream's
  own line and was accurate all along.
- `performance-engineer` attributed to `wshobson/agents` (MIT, Copyright (c)
  2024 Seth Hobson) for the body, 83% verbatim against commit `f662524f`, and to
  `sickn33/agentic-awesome-skills` for the wrapper sections and frontmatter. Its
  `source: community` line is corrected.
- `anti-ai-ui/references/frontend-ui-engineering` attributed to
  `addyosmani/agent-skills` (MIT, Copyright (c) 2025 Addy Osmani), byte-identical
  to upstream commit `cea2f381`.
- `performance-engineer` listed FID among the Core Web Vitals. FID was replaced
  by INP; corrected.
- The Apache-2.0 NOTICE records that `openai/skills` and `anthropics/skills`
  license per skill directory rather than repository-wide, which is why their
  repository-level license appears absent.

### Changed

- `anti-ai-ui/references/design` reclassified as first-party. Its body is
  unchanged since this repository's second commit (`f281274`, 2026-06-19),
  predating any external vendoring here, and verbatim phrase searches return only
  this repository and installs of it.
- `anti-ai-ui/references/frontend-ui-engineering/references/accessibility-checklist.md`
  reclassified as first-party. Upstream ships a different, longer WCAG 2.1 AA
  checklist; this is a shorter WCAG 2.2 AA one with no shared wording.
- Attribution frontmatter added to `git-commit`, `performance-engineer` and
  `frontend-ui-engineering`; GitHub, Inc. and Addy Osmani added to the MIT
  notices.

## [5.1.1] - 2026-10-27

Licensing audit of the vendored skills, done before the first 5.x npm publish.
No functional changes to the CLI, agents or hooks.

### Removed

- `agent-development` skill. It was a near-verbatim copy of
  `anthropics/claude-code` `plugins/plugin-dev/skills/agent-development` (the
  415-line SKILL.md differed only in frontmatter; the other six files were
  byte-identical). That repository's `LICENSE.md` reserves all rights and grants
  no redistribution right, so the skill could not be shipped. Dropped from the
  `agentic` pack.

### Added

- `.agents/licenses/` with the license texts that redistribution requires to
  travel with the material: the Apache-2.0 text, an Apache-2.0 NOTICE naming
  each upstream, the MIT copyright lines read from each upstream's own LICENSE
  file, and the CC BY 4.0 notice for `backend-dev-guidelines`.
- `THIRD_PARTY_NOTICES.md` is now in the published package. It previously existed
  but was missing from the `files` allowlist, so the tarball shipped vendored
  third-party skills with no attribution file at all.
- A "Third-party components" section in `LICENSE`, naming the one carve-out from
  the Dev-OS MIT license.
- Source and license frontmatter on `code-reviewer`, which was a verbatim
  Apache-2.0 copy carrying no attribution.

### Fixed

- `security-review` is recorded as **CC BY-SA 4.0**, not MIT. Its reference
  material is adapted from the OWASP Cheat Sheet Series, and ShareAlike means it
  cannot be relicensed; the root `LICENSE` now says so.
- `seo-geo` is Apache-2.0, not MIT. The upstream LICENSE file is Apache-2.0; the
  earlier MIT claim came from the upstream README badge and a nested plugin.json.
- `seo-geo/references/seo-aeo-best-practices` came from `sanity-io/agent-toolkit`
  (MIT), not from opc-skills.
- `backend-dev-guidelines/references/backend-development` is attributed to
  `MoizIbnYousaf/ai-agent-skills`, the repository the bytes actually came from;
  its own frontmatter declares `wshobson/agents` upstream. Both are MIT.
- Stale upstream URLs updated: `sickn33/antigravity-awesome-skills` to
  `sickn33/agentic-awesome-skills`, `affaan-m/everything-claude-code` to
  `affaan-m/ECC`, `ngrok/agent-skills` to `ngrok/skills`.
- The nine `vercel-labs/agent-skills` skills and `nextjs-supabase-auth` moved to a
  "Declared only" section: their upstreams state a license in the README or
  package metadata but ship no LICENSE file.
- `design-an-interface` and `qa` verified as MIT from `mattpocock/skills`, with the
  commit SHAs pinned since both were since deleted upstream.
- The unverified list went from 15 entries to 4.

## [5.1.0] - 2026-10-25

### Added

- **Commit policy** (`devos commit-policy [status|human|agent]`, also `--commit-policy` on `init` and `update`), stored as `commitPolicy` in `.agents/manifest.json`.
  - `agent` is the default when the Claude Code approval prompt is wired. A Claude Code agent commits with `.agents/scripts/commit.sh --agent "<conventional message>"` when you ask it to, and you approve each commit in the permission prompt. You never need a separate terminal.
  - `human` is the default for other harnesses and keeps the 5.0 behaviour: only a human commits, from their own terminal.
  - `init` and `update` keep an explicit earlier choice. The policy can be changed from anywhere, because the per-commit prompt is the approval.
- `.claude/settings.json` gets the ask rules `Bash(.agents/scripts/commit.sh *)` and `Bash(git push *)`. Explicit ask rules prompt in every permission mode, including auto and `bypassPermissions`, and allow rules cannot override them. The PreToolUse hook also returns `permissionDecision: "ask"` for the canonical command.
- `devos doctor` checks the ask rule, and `devos status` shows the commit policy.

### Changed

- The PreToolUse hook blocks running commit.sh in any form other than the literal `.agents/scripts/commit.sh`: `bash`/`sh`, `./`, absolute paths, `source`, `eval`, variable expansion and command substitution. Those forms would not match the ask rule. **If you scripted `bash .agents/scripts/commit.sh`, call `.agents/scripts/commit.sh` directly.**
- `DEVOS_AGENT_COMMIT` joins the self-approval variables that tool calls may not assign.
- The pre-commit hook accepts a Claude Code agent commit only with `DEVOS_AGENT_COMMIT=1`, `DEVOS_COMMIT_APPROVED=true` and the `agent` policy. Other harness markers are always refused. Run `devos update` (or `.agents/scripts/install-hooks.sh`) to refresh the hook.
- Hard Rules 6 and 8, `/commit`, the `git-ops` skill, README and `docs/PRE_COMMIT_HOOK.md` describe both policies.

## [5.0.0] - 2026-10-22

This is a major release. The agent roster and skill library were consolidated, and several runtime gates were rewired. Run `devos update` in each project; it migrates a 4.x install in place and backs up everything it touches to `.agents/_backup/`.

### Breaking changes

- The roster is now 13 default agents: orchestrator, architect, pm, ui-designer, developer, dba, tester, qa, security, researcher, devops, tech-writer, tech-lead.
  - Merged: executive-proxy into orchestrator (new "Autonomous Mode (/auto)" section), sre into devops (SLOs, incidents, runbooks, observability), release-manager into tech-writer (semver, changelog, release notes, sole Humanizer owner). memory-manager duties moved to the `shared-memory` skill, which the Orchestrator invokes.
  - Moved to the opt-in `maintainer` pack (`.agents/maintainer/`): the telemetry and eval-engineer agents and the `/eval` and `/telemetry` commands. Install them with `devos pack add maintainer`.
- Skills went from 68 to 53. Merged skills now live under their primary's `references/<old>/GUIDE.md`. `.agents/packs.json` (format 2.0.0) gains an `aliases` map, and packs may list `agents` and `commands`.
- New optional packs: `design-data`, `codex`, `google-adk`, `growth`, `web-tools`.
- Claude Code hooks are wired in `.claude/settings.json` (merged with your settings). Dev-OS removes a legacy `.claude/hooks.json` that it wrote itself.
- `AGENTS.md` at the project root is now the canonical cross-harness instructions file (a Dev-OS managed block). CLAUDE.md, GEMINI.md, ANTIGRAVITY.md and the Cursor rule are thin pointers to it that keep the Hard Rules digest. CLAUDE.md imports it with `@AGENTS.md` and GEMINI.md with `@./AGENTS.md`.
- Codex: `.codex/instructions.md` is no longer written, because Codex reads AGENTS.md. `devos update` removes it after taking a backup. If you added your own text outside the Dev-OS markers, only the Dev-OS block is removed and your text stays.
- OpenCode: Dev-OS now writes a schema-valid `opencode.json` at the project root, with `$schema` and `"instructions": [".agents/AGENTS.md"]`. If you already have an `opencode.json`, Dev-OS merges its entry into yours. OPENCODE.md, `.opencode/opencode.json` and `.opencode/rules/devos-rules.md` are retired on the same terms as `.codex/instructions.md`: Dev-OS removes them only when it generated them, and backs them up first.
- `telemetry issue` and `telemetry pr` publish only after a human confirms at an interactive terminal. `--yes` no longer approves publishing, and the commands refuse to run inside an AI agent shell (`CLAUDECODE`, `GEMINI_CLI`, `CODEX_SANDBOX`, `CURSOR_AGENT`, `AI_AGENT` and similar markers, or `DEVOS_AGENT_SHELL`). `--dry-run` works as before.

### Added

- `devos update` migrates 4.x installs:
  - It removes retired agents and commands from `.agents/` and `.claude/`, but only files that Dev-OS generated and nobody edited. Edited files stay in place with a `[ WARN ]`.
  - It retires merged skill directories and installs their primaries. Customized skills are backed up first.
  - Every touched file is copied to `.agents/_backup/migration-<timestamp>/`.
- The manifest records a sha256 for each agent and command file Dev-OS writes (`generatedFiles`), so later updates can tell generated files from user edits.
- `AGENT_ALIASES`: commands that still name a merged agent route to the agent that absorbed it.
- `devos skill add <old-name>` resolves merged names through the packs.json aliases and prints `[ WARN ] <old> was merged into <new>`. Core skills install from the bundled templates, so this works offline.
- `devos skill audit` reports:
  - broken relative and `.agents/` path references;
  - `/name` references to skills that Dev-OS does not ship;
  - descriptions that are not a "Use when ..." trigger of at least 80 characters;
  - `npx -y` and `@latest`;
  - a SKILL.md over 500 lines with no `references/` dir.
  A nested SKILL.md under `references/` is an error.
- `devos pack list` shows the agents and commands that each pack ships.
- A Stop hook (`stop.sh`) asks for a `docs/CURRENT_STATE.md` update when tracked code changed. Opt out with `DEVOS_STOP_GATE=off`.
- `THIRD_PARTY_NOTICES.md` lists vendored skills with their upstream source and license.
- New hook events, wired in `.claude/settings.json`. Dev-OS now owns seven hook scripts, and a user hook in `.agents/hooks/` is still never touched.
  - SubagentStop (`subagent-stop.sh`): a subagent that changed tracked code must write or update a handoff note in `.agents/memory/handoffs/` before it returns. Opt out with `DEVOS_HANDOFF_GATE=off`.
  - PostToolUse (`post-tool-use.sh`, matcher `Edit|Write|MultiEdit`): runs the file-scoped checks on the edited file. These are `ui-taste-check.sh` for UI files, `env-check.sh` for `.env*` files and `db-check.sh` for `*.sql` files. Findings reach Claude on stderr, and the edit is not undone. Opt out with `DEVOS_POST_CHECKS=off`.
  - Compaction re-injection: SessionStart with source `compact` re-injects the mode, the active task, the Hard Rules pointer and the circuit breaker, and leaves the session stamp alone.
- The TRIVIAL fast path is enforced. The Design Gate and the Orchestration Gate allow a small Edit to an existing file when it adds no dependency, schema, migration or auth change. A per-session budget of 30 changed lines, kept in the git directory as `devos-trivial-budget`, stops many tiny edits from adding up. Opt out with `DEVOS_TRIVIAL_FASTPATH=off`.
- `install-hooks.sh` installs a `pre-merge-commit` git hook that refuses merge commits from AI agent shells. Re-run `.agents/scripts/install-hooks.sh`, or `devos update`, to get it.
- `.claude/skills/<name>` is created for every installed skill, so Claude Code discovers it. Each entry is a relative symlink to `../../.agents/skills/<name>`. On Windows, or when a symlink cannot be created, Dev-OS copies the skill instead and records the copy's hash in the manifest. A real directory of yours at that path is never replaced. `pack add`, `skill add|sync|update` and `update` keep the links in sync, and `devos doctor` reports drift: missing or broken links, stale copies, and links to removed skills.
- `devos spec waves <slug> [--json]` reads `docs/specs/<slug>/tasks.md` and prints the parallel waves, which are the topological layers over `depends:`. It fails on cycles and on unknown task ids.
- `devos spec check <slug> [--json]` verifies three things: every requirement in `requirements.md` is covered by a task, every `covers:` id exists, and every task has exactly one `depends:`, `covers:` and `verify:` line. It exits 1 on any gap. Projects get the template at `docs/specs/_template/`.
- The Rule 22 plan gate accepts an approved `docs/specs/<slug>/tasks.md` as the plan. The gate is in the rules digest and in `devos auto --step implementation`.
- `devos build-plugin [--out <dir>] [--print-path]` builds a Claude Code plugin into `dist/claude-plugin/` by default. The plugin contains `.claude-plugin/plugin.json`, the 13 agents, the commands, the core skills, and `hooks/hooks.json`, which runs the bundled hook scripts from `${CLAUDE_PLUGIN_ROOT}`. The repository root has a `.claude-plugin/marketplace.json` that lists the plugin with a `command` source, which builds the pinned npm version on the user's machine. Plugin agents ignore `permissionMode`, `hooks` and `mcpServers`, and a plugin cannot add permission rules, so `devos init` remains the primary install.

### Changed

- The rules digest in CLAUDE.md, AGENTS.md, GEMINI.md, ANTIGRAVITY.md and the Cursor rule again includes the Design Gate (R15), the Humanizer gate (R16) and the Task Board declaration (R23).
- Hook scripts read Claude Code's JSON on stdin and block with exit code 2 and a reason on stderr.
- Generated subagents carry `name`, `description`, `tools` and `model` from the agent's own frontmatter.
- Init and update make no network calls by default. `DEVOS_OFFLINE=1` skips every network step. Gitleaks is detected only; `--install-gitleaks` installs it through `.agents/scripts/install-hooks.sh`, which is now the only place that downloads it.
- Init adds `.agents/bin/` to the project's `.gitignore`.

### Fixed

- Settings merge no longer deletes a user's own hooks that live in `.agents/hooks/` (for example `my-audit.sh`). Only the seven Dev-OS hook scripts count as Dev-OS-owned.
- Upgrade data safety:
  - `update`, `init` and `pack add` no longer overwrite an edited `.claude/agents` or `.claude/commands` file, or a user-authored file that shares a Dev-OS name. The file is kept with a `[ WARN ]`. `--force` regenerates it after taking a backup.
  - Re-running `init` merges the existing manifest instead of resetting it. It keeps installed packs, skill records, `generatedFiles` and the recorded `--no-hooks` choice.
  - `pack add` and `update` keep customized skills unless you pass `--force`, which backs them up first. An upgrade installs core and stack-pack skills that are missing.
  - A 4.x install keeps its hooks choice on upgrade.
  - Retired files are matched against the exact output of every released generator, so any edit, including one to the frontmatter or the routing footer, keeps the file.
  - A legacy `.claude/hooks.json` is backed up before it is removed.
  - `skill audit` treats a nested SKILL.md in a third-party skill as a warning.
- The Cursor rule (`.cursor/rules/devos.mdc`) no longer sets `globs: *` next to `alwaysApply: true`, and its description is YAML-safe. Like the generated agents, it is now overwritten only when it is unedited.
- Init no longer copies the Dev-OS repo's `.agents/evals/reports/latest-scorecard.json` into projects, and the package no longer ships the repo's own `.agents/manifest.json`.
- Smoke and eval runs write scorecards to a temp dir (`DEVOS_EVAL_REPORTS_DIR`) instead of the tracked scorecard.

## Earlier releases

See the git tags `v4.5.0` and older.
