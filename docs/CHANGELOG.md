# Changelog

All notable changes to Dev-OS are documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

## [3.0.0] — 2026-09-11

### Major Features & Upgrades
- **Runtime Lifecycle Hook Framework (F1)**: Introduced `.agents/hooks/` (`session-start.sh`, `pre-tool-use.sh`, `session-end.sh`) and `.claude/hooks.json` mapping `SessionStart`, `PreToolUse`, and `SessionEnd`. Mechanically enforces Hard Rule #1 (blocks destructive actions), Hard Rule #8 (blocks raw git commit), Hard Rule #13 (session-end state obligation), and Hard Rule #14 (freshness check).
- **Composable Capability Packs (F2)**: Added pack registry (`.agents/packs.json`) and project manifest (`.agents/manifest.json`). `devos init` now installs lean stack-tailored packs (`core` + target stack), reducing initial token context by 60–75%. Added `devos pack list` and `devos pack add <name>` CLI commands.
- **Structured Shared Memory Vault (F3)**: Added `.agents/memory/` containing Architecture Decision Records (`decisions/ADR-000-template.md`), session handoffs (`handoffs/handoff-template.md`), and `context.json`. Added `devos memory list`, `devos memory handoff`, and `devos memory doctor` CLI commands, along with `.agents/skills/shared-memory/SKILL.md`.
- **Deterministic Task Board & DAG Workflow State (F4)**: Added `docs/TASK_BOARD.md` state machine (`[BACKLOG]`, `[QUEUED]`, `[IN_PROGRESS]`, `[PARALLEL_GATE]`, `[HUMAN_CHECKPOINT]`, `[DONE]`), `/task` slash command (`.agents/commands/task.md`), and `.agents/skills/task-board/SKILL.md`.
- **Multi-Harness Expansion + OpenCode (F5)**: Expanded compilation engine to natively generate rules and configuration across major AI IDEs: **Claude Code** (`.claude/`), **Cursor** (`.cursor/rules/devos.mdc`, `.cursorrules`), **OpenCode** (`OPENCODE.md`, `.opencode/rules/devos-rules.md`, `.opencode/opencode.json`), **Google Antigravity & Gemini** (`ANTIGRAVITY.md`, `GEMINI.md`), and **Codex & Windsurf** (`.codex/instructions.md`, `.windsurfrules`). Added interactive platform selector (Step 3 in `devos init`) and CLI flags (`-p, --platform <name>`, `--harness <list>`) so developers can tailor their workspace for specific tools or generate universal configurations.

## [2.1.1] — 2026-09-10

- **Official npm Scope Release**: Successfully published to npm under `@olives/devos` as public package.

## [2.1.0] — 2026-09-03

- **Official npm Package Scope (`@olives/devos`)**: Formally registered under the official Olives organization on npm as `@olives/devos` (executable CLI binaries remain `devos`, `olives-devos`, and `devos-init`).
- **`devos update` CLI Command**: Safely refreshes `.agents/`, specialist skills, slash commands, and git hooks in existing projects without overwriting custom documentation or stack coding standards.
- **Automated Pre-Commit Hook Installation**: `devos init` now automatically runs `install-hooks.sh` to install `.git/hooks/pre-commit` whenever initialized within a Git repository.
- **Hard Rules Digest in CLAUDE.md**: `bootstrapClaudeMd` injects a complete 14-rule digest directly into `CLAUDE.md` to guarantee AI working agents always load the rules into active context on turn 1.
- **Solo Session Protocol**: Defined the official minimum viable quality gate in `AGENTS.md` and `CLAUDE.md` for single-agent interactive workflows (freshness check, lint/typecheck/test self-verification, standards review, staged human review, commit gate, state obligation).
- **Hard Rule #13 (Session-End State Obligation)**: Requires active agents to update `docs/CURRENT_STATE.md` (and `docs/LESSONS.md` on incidents) before concluding any working session modifying code.
- **Hard Rule #14 (Session-Start Freshness Check)**: Enforces running `git fetch --all --prune` and `git status -sb` before scoping tasks to prevent regressions against stale branches.
- **Pre-Commit Hook Reference**: Added `docs/PRE_COMMIT_HOOK.md` detailing mechanical gate architecture, Gitleaks scanning, and verification procedures.
- **Field Audit Report**: Added `docs/FIELD_REPORT_2026-08-20.md` capturing findings from a real-world multi-day project audit and documenting the resolution of all five recommendations.

### Security & Hardening
- **Un-Pipeable Human Approval Gate**: Hardened `commit.sh` to read the approval token directly from the controlling terminal (`/dev/tty`). Piped stdin (e.g. `printf 'approve\n...' | commit.sh`) is rejected by policy; automated CI environments must explicitly export `DEVOS_HEADLESS_COMMIT=1`.
- **Modern Gitleaks Subcommand**: Replaced legacy `gitleaks protect` with the officially documented `gitleaks git --staged --verbose` in `install-hooks.sh`.
- **Robust Gate Status Check**: Hardened `install-hooks.sh` from fragile `if [ $? -ne 0 ]` checking to direct command execution testing (`if ! gitleaks git --staged --verbose; then`).

## [2.0.0] — 2026-08-14

### Added
- **npm Package (`@olitech010/dev-os`)**: Installable via `npx @olitech010/dev-os init` / `npm install -g @olitech010/dev-os` (the name `devos` on npm belongs to an unrelated 2016 package, and npm blocks unscoped look-alikes such as `dev-os`). Bin commands remain `devos`, `olives-devos`, and `devos-init`
- **Claude Code Integration**: `devos init` now generates `.claude/commands/` and `.claude/agents/` (with valid frontmatter) from the `.agents/` sources, and bootstraps a project `CLAUDE.md`, so slash commands and agent personas are natively discovered by Claude Code. Skippable with `--no-claude`
- **CLI Redesign**: Block-letter DEV-OS banner with attribution, TTY/`NO_COLOR`-aware color output, styled section rules, dynamic component counts, and a boxed init summary
- **Safety**: `devos init` backs up an existing `.agents/` to `.agents/_backup/<timestamp>/` before overwriting; `install-hooks.sh` backs up an existing pre-commit hook; `doctor` now exits non-zero when checks fail
- **Smoke Test**: `npm test` runs `scripts/smoke-test.js` — a real end-to-end init/doctor/reference-integrity check
- **Slash Command System**: 10 pre-configured commands (`/review`, `/commit`, `/test`, `/secure`, `/research`, `/status`, `/fix`, `/architect`, `/refactor`, `/deploy`) with YAML frontmatter schema
- **Memory System**: Project state tracking (`CURRENT_STATE.md`), episodic memory (`LESSONS.md`), context compaction, and pinned safety rules
- **Circuit Breaker Protocol**: Agent loops exceeding 3 iterations automatically halt and escalate to human
- **Memory Manager Agent**: Dedicated agent for context preservation and session handoff
- **Release Manager Agent**: Dedicated agent for versioning, changelogs, and release notes
- **Parallel Quality Gate**: QA, Tester, and Security now run simultaneously instead of sequentially
- **Rollback Protocol**: Defined workflow for handling failed deployments
- **Exploratory Refactoring Workflow**: Safe exploration on throwaway branches
- **Hard Rules #10-12**: Circuit Breaker, Verify Before Implementing, No Heavy Dependencies Without Approval

### Changed
- **Orchestrator**: Removed TRIVIAL direct-commit loophole — all tasks now route through Developer → QA → Human
- **Commit Gate**: Added `DEVOS_COMMIT_APPROVED` token export in `commit.sh` for pre-commit hook compatibility
- **QA vs Tester**: Clarified responsibilities — QA reviews results, Tester owns test creation and execution
- **Standard Feature Delivery**: Parallelized QA + Tester + Security gate
- **Staged Review Model**: Agents write code but never auto-commit; human triggers commit after review

### Security
- **Mechanical Secret Scanning**: `gitleaks` integration via Git pre-commit hook
- **Commit Gate Enforcement**: Raw `git commit` blocked without `DEVOS_COMMIT_APPROVED` token
- **Hard Rule #8**: Mechanical Commit Gate documented and enforced
- **Hard Rule #9**: Zero hardcoded secrets policy

## [1.0.0] — Initial Release

### Added
- Multi-agent roster: Orchestrator, Developer, QA, Tester, DBA, DevOps, Security, Architect, Researcher
- Workflow protocols: Standard Feature Delivery, Bug Fix Delivery, Dependency Update
- Human-in-the-loop commit enforcement via `commit.sh`
- Skill ecosystem with 50+ modular skills
- Hard Rules 1-7
