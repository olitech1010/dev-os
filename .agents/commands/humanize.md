---
name: humanize
description: Audit and scrub AI writing tells from documentation and marketing copy
agent: release-manager
triage_level: STANDARD
workflow: standard
---

Audit markdown prose, PRDs, and documentation against AI writing patterns:

1. Run `.agents/scripts/humanize-check.sh` against the target document (e.g. `docs/`, `README.md`).
2. Apply `.agents/skills/humanizer/SKILL.md` rules to eliminate robotic tells:
   - Not-X-but-Y formulas
   - Forced triads
   - Dramatic one-line closers
   - Inflated significance and filler words ('testament', 'pivotal', 'delve')
   - Chatbot residue
3. Preserve all technical commands, links, and code blocks unchanged.
4. Verify the rewritten copy sounds human, clear, and direct.
