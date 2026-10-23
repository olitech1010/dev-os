---
name: review
description: Run QA code review on current changes
agent: qa
triage_level: STANDARD
workflow: direct
argument-hint: "[path or diff target]"
---

Review the current code changes against our project coding standards.

First run the linter, type-checker, existing test suite, and the applicable Dev-OS scanners (`env-check.sh`, `db-check.sh`, `ui-taste-check.sh`, `humanize-check.sh`).

Focus areas:
- Forbidden patterns from `CODING_STANDARDS.md`
- Missing or inadequate tests (report gaps; the Tester writes them)
- TypeScript type safety (no `any` bypasses)
- TODOs without linked issues
- Code matches conventions in the project's stack standards

Threat review is out of scope here; flag suspected vulnerabilities for `/secure`.

Target: $ARGUMENTS (default: the current uncommitted diff)

Return a structured verdict: **APPROVED** or **CHANGES REQUESTED** with numbered items.
