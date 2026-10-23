---
name: auto
description: Launch autonomous SDLC mode to build an MVP or feature hands-off
agent: orchestrator
triage_level: STANDARD
workflow: autonomous-sdlc
argument-hint: "<MVP concept or feature goal>"
---

Execute autonomous SDLC mode on behalf of the startup founder or product sponsor, following the **Autonomous Mode (/auto)** section of `.agents/agents/orchestrator.md`.

1. **Inception:** Invoke the Architect agent with skill `grill-me` to produce `docs/PROJECT_REQUIREMENTS.md`.
2. **Design System:** Invoke the UI Designer agent with skill `anti-ai-ui` to produce `DESIGN.md` at the project root.
3. **Database Architecture:** Invoke the DBA agent to design migrations and realistic seed fixtures with universal test password `devos123`.
4. **Task DAG:** Initialize `docs/TASK_BOARD.md` and sequence subtasks.
5. **Implementation:** Supervise the Developer implementing features sequentially.
6. **Testing & QA Guide:** Trigger the Tester agent to run test suites and author `docs/TESTING_GUIDE.md` with step-by-step verification flows.
7. **Triple Gate Review:** Run QA review, Security scan, and Humanizer audit by the Tech Writer (`.agents/scripts/humanize-check.sh`).
8. **Final Presentation:** Present a clean executive summary of the staged changes and testing instructions to the user.

Gates are never skipped, fix loops follow the Circuit Breaker in `.agents/AGENTS.md`, and nothing is committed: the human commits via `.agents/scripts/commit.sh` after reviewing the summary.

MVP concept or feature goal: $ARGUMENTS
