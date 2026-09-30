# Implementation Plan: Awesome Design Catalog Integration & UI Redesign Engine

- **Date:** 2026-09-27
- **Spec:** [`docs/superpowers/specs/2026-09-27-awesome-design-catalog-design.md`](file:///Users/user/development/dev-os/docs/superpowers/specs/2026-09-27-awesome-design-catalog-design.md)
- **Status:** In Progress
- **Target Version:** v4.3.0

---

## Overview

This plan details the implementation steps to bundle and index 74 production design systems from [`VoltAgent/awesome-design-md`](https://github.com/voltagent/awesome-design-md), wire them into the `devos design` CLI suite, update the UI Designer agent and slash commands, and establish the multi-agent UI redesign workflow.

---

## Phases & Tasks

### Phase 1: Upstream Sync & Catalog Storage Architecture
- [ ] **Task 1.1:** Create `scripts/sync-design-catalog.js`
  - Zero-dependency Node.js script.
  - Fetches the repository tree or contents from `https://api.github.com/repos/VoltAgent/awesome-design-md/contents/design-md` (or git clone/archive).
  - Downloads all 74 brand `DESIGN.md` files into `.agents/catalog/design-systems/systems/<id>/DESIGN.md`.
  - Extracts frontmatter metadata (`name`, `description`, `colors`, `typography`) and generates `.agents/catalog/design-systems/index.json`.
- [ ] **Task 1.2:** Execute `scripts/sync-design-catalog.js` and verify
  - Confirm all 74 systems are written under `.agents/catalog/design-systems/systems/`.
  - Validate `.agents/catalog/design-systems/index.json` structure, categories, and keyword indexing.
  - Run `.agents/scripts/ui-taste-check.sh` verification pass across the catalog.

### Phase 2: CLI Suite Implementation (`devos design`)
- [ ] **Task 2.1:** Implement `devos design list [category]` in `bin/devos.js`
  - Group 74 systems by the 8 verticals (AI, DevTools, Fintech, Creative, E-commerce, Media, Automotive, Retro).
  - Support category filters (e.g. `devos design list devtools`, `devos design list fintech`).
- [ ] **Task 2.2:** Implement `devos design match "<query>" [options]` in `bin/devos.js`
  - Token scoring across name, summary, category, and keywords.
  - Interactive selection prompt when run in an interactive terminal.
  - Headless `--pick <id_or_number>` for script and autonomous agent execution.
  - `--json` output option for programmatic inspection.
- [ ] **Task 2.3:** Implement `devos design apply <id>` in `bin/devos.js`
  - Copies `.agents/catalog/design-systems/systems/<id>/DESIGN.md` directly to `./DESIGN.md`.
  - Runs `.agents/scripts/ui-taste-check.sh` to confirm taste standards.
  - Prints guidance on orchestrating the redesign with `/redesign`.
- [ ] **Task 2.4:** Update `devos help`, `devos doctor`, and CLI command routing.

### Phase 3: Agent & Slash Command Integration
- [ ] **Task 3.1:** Update `.agents/agents/ui-designer.md`
  - Replace procedural generation with catalog search and matching via `devos design match` or `devos design apply`.
- [ ] **Task 3.2:** Update `.agents/commands/design.md`
  - Point to the catalog matching workflow.
- [ ] **Task 3.3:** Create `.agents/commands/redesign.md`
  - Slash command that triggers the multi-agent UI redesign workflow when an existing project updates `DESIGN.md`.

### Phase 4: Multi-Agent UI Redesign Workflow & Documentation
- [ ] **Task 4.1:** Author `docs/DESIGN_CATALOG.md`
  - Complete user and agent guide on browsing, applying, and synchronizing design systems.
  - Step-by-step instructions for orchestrating full UI refactors.
- [ ] **Task 4.2:** Update `docs/SLASH_COMMANDS.md`, `docs/GETTING_STARTED.md`, and `README.md`.

### Phase 5: Verification, Scanners & Smoke Tests
- [ ] **Task 5.1:** Update `scripts/smoke-test.js`
  - Add assertions verifying `index.json` contains 74 systems.
  - Test `devos design list`, `devos design match --json`, and `devos design apply <id>`.
  - Confirm pre-tool-use hook passes when `devos design apply` creates `DESIGN.md`.
- [ ] **Task 5.2:** Run full evaluation test suite (`node scripts/eval-runner.js`).
- [ ] **Task 5.3:** Run all 4 mechanical scanners:
  - `bash .agents/scripts/ui-taste-check.sh`
  - `bash .agents/scripts/humanize-check.sh docs/`
  - `bash .agents/scripts/env-check.sh`
  - `bash .agents/scripts/db-check.sh`

---

## Execution Order
1. Phase 1 (Sync script & catalog population)
2. Phase 2 (CLI suite `devos design list/match/apply`)
3. Phase 3 (Agent prompts & slash commands)
4. Phase 4 (Documentation)
5. Phase 5 (Smoke tests, evals & scanner verification)
