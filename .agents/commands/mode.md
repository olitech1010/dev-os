---
name: mode
description: Inspect or switch the locked Dev-OS SDLC execution mode
agent: orchestrator
triage_level: TRIVIAL
workflow: direct
argument-hint: "[status|interactive|guided|auto|audit]"
---

Inspect or switch the session execution mode.

The active mode is locked in `.agents/memory/session.json`. It must never be switched
silently; an explicit invocation is required.

Requested mode: $ARGUMENTS

1. If no mode was given (or `status`), run `devos mode status` to show the current locked mode, orchestrator lock, and
   whether delegation is required.
2. To switch to the requested mode, confirm with the human, then run `devos mode <interactive|guided|auto|audit>`. This is the ONLY
   supported way to change modes.
3. After switching, confirm the new mode and delegation requirement to the human.

Available modes:
- `interactive` — pair-programming with staged human reviews (default).
- `guided` — step-by-step confirmation at each SDLC stage (delegation enforced).
- `auto` — hands-off MVP builder; the Orchestrator runs its Autonomous Mode (/auto) section (delegation enforced).
- `audit` — read-only diagnostics; no production writes.

Never change mode implicitly based on task content.
