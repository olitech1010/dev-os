---
name: deploy
description: Prepare deployment plan and run checklist
agent: devops
triage_level: CRITICAL
workflow: direct
---

Prepare a deployment plan for the specified target.

1. Run the deployment checklist from `.agents/skills/deployment-checklist/SKILL.md`
2. Verify all tests pass and QA has approved
3. Prepare the deployment plan — do NOT execute without Human approval
4. Present the plan for HUMAN CHECKPOINT

Target: $ARGUMENTS

NEVER deploy to production without explicit Human approval.
