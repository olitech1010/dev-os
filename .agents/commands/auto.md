---
name: auto
description: Launch autonomous SDLC mode to build an MVP or feature hands-off
agent: executive-proxy
triage_level: STANDARD
workflow: autonomous-sdlc
---

Execute autonomous SDLC mode on behalf of the startup founder or product sponsor.

1. **Inception:** Invoke the Architect agent with skill `grill-me` to produce `docs/PROJECT_REQUIREMENTS.md`.
2. **Design System:** Invoke the UI Designer agent with skill `ui-ux-pro-max` to produce `docs/DESIGN.md`.
3. **Database Architecture:** Invoke the DBA agent to design migrations and realistic seed fixtures with universal test password `devos123`.
4. **Task DAG:** Initialize `docs/TASK_BOARD.md` and sequence subtasks.
5. **Implementation:** Supervise the Developer implementing features sequentially.
6. **Testing & QA Guide:** Trigger the Tester agent to run test suites and author `docs/TESTING_GUIDE.md` with step-by-step verification flows.
7. **Triple Gate Review:** Run QA review, Security scan, and Humanizer audit (`.agents/scripts/humanize-check.sh`).
8. **Final Presentation:** Present a clean executive summary of the staged changes and testing instructions to the user.
