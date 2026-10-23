---
name: autonomous-sdlc
description: "Use when running or reasoning about the Dev-OS software lifecycle modes (interactive, guided, auto via /auto or devos run, and read-only audit), the 10-stage autonomous pipeline, or the handoffs and gates between stages (design gate, QA, security, humanizer)."
license: MIT
metadata:
  version: "1.0.0"
  supported_modes:
    - interactive
    - guided
    - auto
    - audit
---

# Autonomous SDLC Protocol

The Dev-OS Autonomous SDLC Protocol defines how agents collaborate to take a product idea from inception to verified, tested, and documented code.

---

## 1. The Four Execution Modes

Dev-OS operates in four distinct execution modes:

### 1. `interactive` (Default)
- **Target Audience:** Professional software engineers pair-programming with AI.
- **Workflow:** Conversational with the Orchestrator. The Orchestrator delegates tasks to specialists (Developer, QA, Tester, DBA).
- **Gate:** Staged review before every commit via `.agents/scripts/commit.sh`. Human retains fine-grained control.

### 2. `guided`
- **Target Audience:** Technical leads who want high-level steering without writing boilerplate.
- **Workflow:** The system proceeds through the SDLC phase by phase, explicitly pausing at the end of each stage (Requirements approved? Design approved? Schema approved? Implementation approved?) for explicit human sign-off.

### 3. `auto` (`devos run` / `/auto`)
- **Target Audience:** Startup founders, CEOs, and product managers who want to build an MVP from an idea hands-off.
- **Workflow:** The **Orchestrator** runs in Autonomous Mode (see its "Autonomous Mode (/auto)" section) and oversees the entire team through all 10 stages without requiring technical human intervention. The Tech Lead stays a read-only arbiter for deadlocks.
- **Key Deliverable:** At the conclusion of the run, the system delivers:
  1. Full working codebase with passing tests.
  2. `docs/PROJECT_REQUIREMENTS.md` (Product spec).
  3. `DESIGN.md` at project root (written by the UI Designer under `anti-ai-ui`).
  4. Database schema + realistic seed data.
  5. `docs/TESTING_GUIDE.md` (Interactive step-by-step testing guide with `devos123` test accounts).
  6. Humanized documentation with zero AI fluff.

### 4. `audit`
- **Target Audience:** Reviewers auditing an existing repository for security, architecture, and code health.
- **Workflow:** Read-only analysis. Security and QA agents scan the repository (plus the Eval Engineer as an optional step when the `maintainer` pack is installed) and produce comprehensive diagnostic reports in `/docs/` without modifying production code.

---

## 2. Autonomous Mode (Full SDLC Workflow)

In `auto` mode, the team executes the following 10-stage pipeline:

```
[ Idea / Prompt ]
       │
       ▼
1. INCEPTION (Architect) ────────────────► docs/PROJECT_REQUIREMENTS.md (grill-me)
       │
       ▼
2. DESIGN GATE (UI Designer) ────────────► DESIGN.md (at project root via anti-ai-ui)
       │
       ▼
3. ARCHITECTURE & DB (DBA) ──────────────► Migrations + Seed Fixtures (devos123)
       │
       ▼
4. TASK BOARD DAG (Orchestrator) ────────► docs/TASK_BOARD.md
       │
       ▼
5. IMPLEMENTATION (Developer) ───────────► Clean code (Dynamic subagents)
       │
       ▼
6. TEST SUITE (Tester) ──────────────────► Automated unit & integration tests
       │
       ▼
7. TESTER GUIDE (Tester & QA) ───────────► docs/TESTING_GUIDE.md (Step-by-step walkthrough)
       │
       ▼
8. QUALITY ASSURANCE (QA) ───────────────► Standards, typing, no forbidden patterns
       │
       ▼
9. SECURITY AUDIT (Security) ────────────► OWASP Top 10, Auth/RLS, Secret scan
       │
       ▼
10. HUMANIZER AUDIT (Tech Writer) ───────► Scrub AI tells from all docs and PRDs
       │
       ▼
[ FINAL STAGED SUMMARY PRESENTED TO FOUNDER ]
```

---

## 3. Strict Delegation Rule: No Solo Monolithic Working

**Hard Rule:** The Orchestrator or active agent MUST NOT act as a solo monolith.
- UI code MUST NOT be written until `DESIGN.md` exists at project root.
- The Developer MUST NOT write code without passing through the QA gate.
- The Tester MUST author `docs/TESTING_GUIDE.md` so non-technical stakeholders can verify the application.
- All documentation in `/docs/` MUST be scanned using `.agents/scripts/humanize-check.sh`.

---

## 4. SDLC Pipeline Runner CLI Reference

The SDLC runner executes, tracks, and gates the 10-stage pipeline. It ships inside the Dev-OS CLI package (invoked as `devos run`) and is not copied into your project. On the first run it creates the runtime state file .agents/memory/sdlc-state.json (absent until then, and gitignored by `devos init`).

### Commands

| Command | Description |
|---|---|
| `devos run "<idea>"` | Initialise a new pipeline run for a product idea |
| `devos run --status` | Show current stage and pipeline progress |
| `devos run --step <stage-id>` | Print the ready-to-paste delegation prompt for one stage |
| `devos run --resume` | Resume an interrupted run from the current stage |
| `devos run --dry-run "<idea>"` | Preview pipeline + gate checks without writing state |
| `devos run --list` | List all 10 stages with agents, skills, and deliverables |
| `devos run --reset` | Clear state to start a fresh run |
| `devos run --json` | Output pipeline state as JSON |

### Stage IDs

`inception` · `design` · `database` · `tasks` · `implementation` · `tests` · `testing-guide` · `qa` · `security` · `humanize`

### Stage 5 — Implementation: Triple Gate

Stage 5 enforces **three** simultaneous conditions before the Developer may write any code:

| # | Gate | Required File/Dir |
|---|---|---|
| 1 | Mandatory Design Gate | `DESIGN.md` at project root |
| 2 | Task Decomposition Gate | `docs/TASK_BOARD.md` |
| 3 | **Implementation Plan Gate** | Any file in `docs/plans/` (produced by `brainstorming` → `writing-plans`) |

All three must be satisfied. `devos run --step implementation` shows which conditions are blocking.

### Typical Workflow

```
$ devos run "Build a B2B SaaS payroll tool for Ghana"
# → Initialises pipeline, shows stage list with gate status

$ devos run --step inception
# → Prints ready-to-paste delegation prompt for the Architect agent

# (paste into AI assistant, receive PROJECT_REQUIREMENTS.md)

$ devos run --step design
# → Prints delegation prompt for the UI Designer (design catalog match)

$ devos run --step tasks
# → Orchestrator prompt: produce TASK_BOARD.md + trigger brainstorming → writing-plans

$ devos run --step implementation
# → Shows all 3 gate statuses; gives Developer delegation prompt only when all pass

# ... continue stage by stage ...

$ devos run --status
# → Shows live progress dashboard with checked/unchecked stages
```

