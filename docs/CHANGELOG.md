# Changelog

All notable changes to Dev-OS are documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

## [4.1.0] — 2026-09-15

### Distinctive Craft, Anti-AI UI Gate & UI/UX Pro Max Engine Hardening
- **Anti-AI UI & Distinctive Craft Standard (Hard Rule #19)**: Authored `.agents/skills/anti-ai-ui/SKILL.md` cataloging 20 common low-effort AI UI clichés ("AI slop") and enforcing concrete human-crafted counter-patterns (vector-only SVGs, contextual workspace navigation, domain-grounded color palettes, asymmetric Bento grids, authentic domain entities, tactile button press affordances, and accessible focus rings).
- **Mechanical UI Taste Scanner (`ui-taste-check.sh`)**: Built executable zero-dependency scanner `.agents/scripts/ui-taste-check.sh` that automatically audits JSX, TSX, Vue, Svelte, and HTML templates for raw emojis, sparkle icon clichés (`<Sparkles`, `Wand2`), lazy indigo-purple gradients, generic marketing copy, placeholder data ("John Doe"), and suppressed focus rings.
- **UI/UX Pro Max Recommendation Engine Fix**: Corrected CLI integration in `ui-designer.md` and `/design` command to invoke `python3 .../search.py "<domain>" --design-system -p "<ProjectName>" --format markdown`, ensuring complete color, typography, and layout tokens are extracted directly from the 161-product database into root `DESIGN.md`.
- **Quality Gate Integration**: Updated `developer.md` and `qa.md` to require `.agents/scripts/ui-taste-check.sh` verification before presenting code for review. Wired scanner into `bin/devos.js` installer, updater, and `runDoctor`.
- **Expanded Test Suite (84/84 Passing)**: Added smoke test assertions verifying `ui-taste-check.sh` catches AI UI slop, passes clean distinctive code, and runs across all 67 skills.

## [4.0.1] — 2026-09-13

### Root Design System, Multi-Harness Governance & Automated Zero-Config Setup
- **Root `DESIGN.md` Placement**: Relocated `DESIGN.md` from `docs/DESIGN.md` to the project root (`DESIGN.md`), sitting alongside `CODING_STANDARDS.md` as a top-level architectural contract. Updated all 15 agent prompts, commands (`/design`, `/auto`), pre-tool-use hooks, and CLI doctor/status checks to coordinate with root `DESIGN.md` while maintaining backward-compatible fallback for existing clones.
- **8-Step Interactive Installer Wizard**: Upgraded `devos init` to systematically prompt for Environment Type, Tech Stack, AI Coding Platform / Harness (Google Antigravity & Gemini [Recommended], Claude Code, Cursor, OpenCode, Codex / Windsurf, All), SDLC Execution Mode (`interactive`, `guided`, `auto`, `audit`), Autonomous Goal / Product Idea, Capability Scope (Lean Stack Pack vs Full Skills Arsenal), Anonymous Telemetry buffer, and Git Pre-Commit Hook installation.
- **Enhanced Google Antigravity & Gemini Support**: Enforced open Agent Skills Standard compliance across all 66 skills in `.agents/skills/`. Extended `generateAntigravityConfig` to generate `ANTIGRAVITY.md` and `GEMINI.md` with explicit SDLC governance, Mandatory Design Gate rules, and universal test password specifications (`devos123`).
- **Autonomous MVP Goal Integration**: Autonomous product prompts entered during `devos init` or via `devos run "<goal>"` are automatically tracked in `.agents/manifest.json` and initialized as `TASK-001` in `docs/TASK_BOARD.md`.
- **Automated Hooks & Built-in Secret Scanner**: Completely eliminated manual post-installation requirements. `devos init` now ensures git repository initialization, installs `.git/hooks/pre-commit`, and configures secret scanning out of the box (with automated Gitleaks installation via Homebrew and built-in regex fallback blocking AWS, GitHub, OpenAI, Anthropic, Google, and private keys).
- **Prompting Guide ("Prompt the What, Not the How")**: Added Section 4 to `README.md`, Section 9 to `docs/TUTORIAL.md`, and onboarding tips in `bin/devos.js`. Teaches the 3-step Golden Prompt Formula (Goal + Context/Constraints + Desired Deliverable) and includes real-world Before/After case studies so users never need to micromanage agent roles or security rules.
- **Documentation & Command Reference Parity**: Completely refreshed `docs/GETTING_STARTED.md`, `README.md`, and `docs/TUTORIAL.md` with complete CLI tables, platform walkthroughs, and mechanical gate instructions.

## [4.0.0] — 2026-09-13

### Autonomous SDLC, Mechanical Enforcement & Telemetry
- **Mandatory Design Gate (Hard Rule #15)**: Integrated mechanical pre-tool-use hook (`.agents/hooks/pre-tool-use.sh`) that blocks creation or editing of frontend UI files (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.html`, `*.css`) until `docs/DESIGN.md` is authored. Added UI Designer agent (`.agents/agents/ui-designer.md`), `/design` slash command, and design token extraction from `ui-ux-pro-max`.
- **Autonomous SDLC Modes & Executive Proxy**: Added four standardized SDLC modes (`interactive`, `guided`, `auto`, `audit`) in `.agents/skills/autonomous-sdlc/SKILL.md`. Introduced the Executive Proxy persona (`.agents/agents/executive-proxy.md`) and `devos run "<idea>"` / `devos auto` CLI runners to enable hands-off MVP delivery for non-technical startup founders.
- **Default Anonymous Telemetry & Local RCA Engine**: Telemetry is now enabled by default (`telemetry: on (recommended)`). Gate rejections and failure events are buffered locally in `.agents/telemetry/events.jsonl` with strict zero-secret sanitization. Added Telemetry Agent (`.agents/agents/telemetry.md`), `/telemetry` slash command, and CLI operations (`devos telemetry status/report/enable/disable/clear`).
- **Humanizer Documentation Gate (Hard Rule #16)**: Integrated `blader/humanizer` into `.agents/skills/humanizer/SKILL.md` with an executable scanner (`.agents/scripts/humanize-check.sh`) to mechanically detect and eliminate 25 cataloged robotic AI writing tells across all markdown documents.
- **Interactive Testing Guide (Hard Rule #17)**: Authored `.agents/skills/testing-guide/SKILL.md` enforcing `docs/TESTING_GUIDE.md` deliverable with step-by-step interactive checklists and standardized universal development test credentials (`devos123`).
- **Skills Registry Integration (`skills.sh` / `npx skills`)**: Added first-class `devos skill` CLI suite (`add`, `update`, `check`, `find`, `list`) bridging Dev-OS seamlessly with the open agent skills ecosystem, supporting `.skill-lock.json` and bi-directional upstream updates.
- **Expanded Specialist Roster (15 Agents, 66 Skills)**: Added `ui-designer`, `executive-proxy`, `telemetry`, and `eval-engineer` personas, and updated capability packs (`core`, `frontend-pro`, `backend-pro`, `autonomous`, `cloud-data`).

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
