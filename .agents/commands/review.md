---
name: review
description: Run QA code review on current changes
agent: qa
triage_level: STANDARD
workflow: direct
---

Review the current code changes against our project coding standards.

Focus areas:
- Security vulnerabilities and forbidden patterns
- Missing or inadequate tests
- Hardcoded secrets or credentials
- TypeScript type safety (no `any` bypasses)
- TODOs without linked issues
- Code matches conventions in the project's stack standards

Target: $ARGUMENTS

Return a structured verdict: **APPROVED** or **CHANGES REQUESTED** with numbered items.
