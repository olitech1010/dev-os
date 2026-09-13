---
name: autonomous-sdlc
description: |
  Comprehensive protocol for autonomous software development lifecycle execution across four standardized modes:
  interactive (default developer pair-programming), guided (checkpoint approval), auto (hands-off MVP builder for founders/CEOs),
  and audit (read-only diagnostic). Enforces strict multi-agent handoffs, mandatory design gates, and testing guides.
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
- **Workflow:** An **Executive Proxy** agent mounts the Tech Lead seat and oversees the entire team through all 10 stages without requiring technical human intervention.
- **Key Deliverable:** At the conclusion of the run, the system delivers:
  1. Full working codebase with passing tests.
  2. `docs/PROJECT_REQUIREMENTS.md` (Product spec).
  3. `DESIGN.md` at project root (Extracted from `ui-ux-pro-max`).
  4. Database schema + realistic seed data.
  5. `docs/TESTING_GUIDE.md` (Interactive step-by-step testing guide with `devos123` test accounts).
  6. Humanized documentation with zero AI fluff.

### 4. `audit`
- **Target Audience:** Reviewers auditing an existing repository for security, architecture, and code health.
- **Workflow:** Read-only analysis. Security, QA, and Eval Engineer agents scan the repository and produce comprehensive diagnostic reports in `/docs/` without modifying production code.

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
2. DESIGN GATE (UI Designer) ────────────► DESIGN.md (at project root via ui-ux-pro-max)
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
10. HUMANIZER AUDIT (Release Manager) ───► Scrub AI tells from all docs and PRDs
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
