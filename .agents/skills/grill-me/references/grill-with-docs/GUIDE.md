---
name: grill-with-docs
description: Use when grilling a plan or design should also record decisions as ADRs and build a domain glossary as the interview goes. Merged into grill-me in Dev-OS 5.0.
disable-model-invocation: true
---

# Grill With Docs

A relentless interview to sharpen a plan or design that also creates docs as it goes.

The original upstream text only pointed at two skills (`/grilling` and `/domain-modeling`) that Dev-OS does not ship. This guide replaces that pointer with the equivalent procedure using shipped skills.

1. Run the grilling dimensions in `../../SKILL.md` (grill-me) against the plan, one dimension at a time.
2. When an answer settles an architectural choice, write an ADR in `.agents/memory/decisions/` following the `shared-memory` skill.
3. Each time a domain term is defined or disambiguated, add it to a glossary (default: `docs/GLOSSARY.md`, one term per line with a one-sentence definition). Reuse the user's own words.
4. Mark anything still unresolved as an **OPEN QUESTION** and list it at the end of the session.
