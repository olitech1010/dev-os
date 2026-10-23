---
name: spec
description: Write a feature spec (requirements, design, tasks) with a human checkpoint after each phase
agent: architect
triage_level: STANDARD
workflow: spec-driven
argument-hint: "<feature slug or description>"
---

Run the Spec-Driven Delivery workflow using `.agents/skills/spec-driven/SKILL.md`.

1. Pick a kebab-case slug for the feature and create `docs/specs/<slug>/` from the skill's templates. If the spec already exists, read it and resume at the earliest phase that needs work.
2. Requirements: write `requirements.md` with `### Rn: title` headings, user stories, and EARS acceptance criteria ("WHEN ... THE SYSTEM SHALL ..."). HUMAN CHECKPOINT: stop and wait for approval.
3. Design: write `design.md` with a trace table from every R id to the part of the design that handles it. Verify library APIs before citing them. HUMAN CHECKPOINT: stop and wait for approval.
4. Tasks: write `tasks.md` in the parseable format (`### Tn: title`, `- depends:`, `- covers:`, `- verify:`), then run `devos spec check <slug>` and `devos spec waves <slug>` and fix every finding. HUMAN CHECKPOINT: stop and wait for approval.
5. Hand the approved `tasks.md` to the Orchestrator as the Rule 22 implementation plan. Do not write production code.

Feature: $ARGUMENTS
