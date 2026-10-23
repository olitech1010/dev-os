---
name: tech-writer
description: Author technical documentation and architecture decision records
agent: tech-writer
triage_level: TRIVIAL
workflow: documentation
argument-hint: "<documentation scope>"
---

Author and update documentation for the system.

1. Review public APIs and architecture changes
2. Draft clear, concise developer guides and ADRs in `docs/`
3. Run the humanizer check (`.agents/scripts/humanize-check.sh`)
4. Present changes for review

Documentation scope: $ARGUMENTS
