# Project State

> This file is maintained by the Orchestrator agent. It is updated at each phase transition to preserve context across long sessions.

## Current Task
- **Task:** TASK-007: Docs/Package Separation — **COMPLETE** (committed, pushed to origin)
- **Branch:** main
- **Triage Level:** STANDARD
- **Status:** DONE — ready for next milestone (TASK-004 or TASK-005)

## Active Agents
| Agent | Status | Current Assignment |
|---|---|---|
| Orchestrator | ACTIVE | Ready to scope TASK-004 or TASK-005 |
| Memory Manager | ACTIVE | Updated context.json, task board, changelog v4.5.0 |

## Recent Decisions
- **TASK-007 — Docs/Package Separation**: Separated shipped artifacts (`templates/`) from maintainer workspace (`docs/`) to eliminate personal-state leakage from npm package and GitHub clones.
  - **npm package hygiene**: Precise `files` allowlist drops `docs/` and bulk `.agents/`; ships only `templates/`, curated `.agents/` subpaths. Verified: 0 personal artifacts in tarball.
  - **Install-time scaffolding**: `devos init` installs public docs from `templates/docs/`, state scaffolds (`CURRENT_STATE`, `TASK_BOARD`, `LESSONS`, `context.json`) from `templates/scaffolds/`.
  - **Maintainer workspace**: `docs/` now holds personal live state + research/plans, all gitignored. Clones get clean scaffolds via `devos scaffold`.
  - **Git hygiene**: Personal files `git rm --cached` + gitignored.
- **Version bump**: 4.4.0 → 4.5.0 (includes TASK-006 + TASK-007).
- **All gates green**: 123/123 smoke, 38/38 eval (100%).

## Blockers
- None. Ready to proceed to TASK-004 (Telemetry RCA Auto-PR) or TASK-005 (Skills Registry Sync).

## Context Summary
Dev-OS v4.5.0 delivers clean package/clones + Orchestrator enforcement. The templates/workspace split eliminates the #1 complaint from field reports: personal state leaking to users. Orchestrator mode now persists via session lock, per-turn re-injection, and the Orchestration Gate (MREE). Full smoke suite passes at 123 assertions; eval suite passes at 38/38 (100%). Zero external npm runtime dependencies.