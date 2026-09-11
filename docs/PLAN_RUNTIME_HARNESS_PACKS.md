# Implementation Plan: Dev-OS v3 Runtime, Hooks, Memory, Packs & Multi-Harness

## Overview
This document specifies the architecture and implementation plan for the major feature upgrades identified in `docs/2026-09-03-devos-ecc-gap-analysis.md`:
1. **F1 — Runtime Hook Framework** (`.claude/hooks.json` & `.agents/hooks/*.sh`)
2. **F2 — Composable Capability Packs** (`devos init --stack <name>`, `devos pack`, `.agents/manifest.json`)
3. **F3 — Structured Shared Memory Vault** (`.agents/memory/`, ADRs, session handoffs, `devos memory`)
4. **F4 — Deterministic Task Board & DAG Workflow State** (`docs/TASK_BOARD.md`, `.agents/commands/task.md`)
5. **F5 — Multi-Harness Expansion** (Claude Code, Cursor, OpenCode, Gemini/AGY, Codex/Windsurf)

All implementations adhere strictly to the **Zero-Dependency CLI constraint** (pure Node.js built-ins) and maintain backward compatibility.

---

## Architecture Breakdown

### 1. F1: Runtime Hook Framework
- **Goal**: Move mechanical enforcement from commit-time only to runtime session lifecycle events.
- **Hook Scripts** in `.agents/hooks/`:
  - `session-start.sh`: Enforces Hard Rule #14 (`git fetch --all --prune`) and prints active Dev-OS rules digest.
  - `pre-tool-use.sh`: Enforces Hard Rule #1 (blocks destructive commands like `rm -rf /`, `DROP TABLE`, un-gated raw `git commit`).
  - `session-end.sh`: Enforces Hard Rule #13 (verifies `docs/CURRENT_STATE.md` updated before concluding).
- **Harness Hook Map**: `.claude/hooks.json` mapping `SessionStart`, `PreToolUse`, `SessionEnd`.
- **Permissions**: Automatically `chmod 755` during `devos init` and `devos update`.

### 2. F2: Composable Capability Packs
- **Goal**: Reduce token context window bloat by 60–75% while maintaining on-demand skill access.
- **Pack Registry**: `.agents/packs.json` defining:
  - `core`: 10 foundational skills (git-ops, task-contract, brainstorming, shared-memory, task-board, etc.) + 11 agents + 11 slash commands.
  - `nextjs`: React, Next.js, Vercel, Supabase, Tailwind, UI engineering.
  - `laravel`: Laravel specialist, security, TDD, verification, backend patterns.
  - `python`: Dependencies, Django, FastAPI, backend patterns.
  - `data-ai`: BigQuery, Spark, Airflow, dbt, Dataform, ML best practices.
  - `mobile`: React Native, Expo, mobile design.
- **Manifest Tracking**: `.agents/manifest.json` recording installed packs for safe updates.
- **CLI Commands**:
  - `devos pack list`: List available and installed packs.
  - `devos pack add <name>`: Inject pack skills into existing project.

### 3. F3: Structured Shared Memory Vault
- **Goal**: Lossless context handoff across sessions and agents.
- **Directory**: `.agents/memory/`:
  - `decisions/`: Architecture Decision Records (`ADR-000-template.md`).
  - `handoffs/`: Timestamped session handoffs (`handoff-template.md`).
  - `context.json`: Structured JSON capturing active branch, sprint focus, blockers.
- **Skill**: `.agents/skills/shared-memory/SKILL.md`.
- **CLI Commands**:
  - `devos memory list`: List ADRs and recent handoffs.
  - `devos memory handoff`: Generate a timestamped handoff pre-populated with git state.
  - `devos memory doctor`: Verify memory structure.

### 4. F4: Deterministic Task Board & DAG Workflow State
- **Goal**: Transition multi-agent workflow from informal narrative to a stateful DAG.
- **Board File**: `docs/TASK_BOARD.md` with Kanban/DAG columns: `[BACKLOG]`, `[QUEUED]`, `[IN_PROGRESS]`, `[PARALLEL_GATE]`, `[HUMAN_CHECKPOINT]`, `[DONE]`.
- **Skill**: `.agents/skills/task-board/SKILL.md` defining transition invariants.
- **Command**: `.agents/commands/task.md` (`/task`) for viewing and transitioning tasks.

### 5. F5: Multi-Harness Expansion (+ OpenCode)
- **Goal**: Provide native agent, command, and rules discovery across all major AI development tools.
- **Adapters**:
  - **Claude Code**: `.claude/commands/`, `.claude/agents/`, `.claude/hooks.json`, `CLAUDE.md`.
  - **Cursor**: `.cursor/rules/devos.mdc` (rich MDC rule with glob triggers and frontmatter) + `.cursorrules`.
  - **OpenCode**: `OPENCODE.md`, `.opencode/rules/devos-rules.md`, `.opencode/opencode.json`.
  - **Gemini / Antigravity**: `GEMINI.md`.
  - **Codex / Windsurf**: `.codex/instructions.md`, `.windsurfrules`.
- **CLI Flags**: `--harness <list>` or `--all-harnesses`.

---

## Testing & Verification
- Extend `scripts/smoke-test.js` to validate all new directories, files, hooks, permissions, multi-harness outputs, and CLI commands.
