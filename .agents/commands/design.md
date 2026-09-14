---
name: design
description: Extract design tokens and archetype from ui-ux-pro-max and author DESIGN.md at project root
agent: ui-designer
triage_level: STANDARD
workflow: standard
---

Execute the Mandatory Design Gate workflow:

1. Analyze project domain (SaaS, dev tool, mobile, dashboard, restaurant POS, landing page, consumer).
2. Run `ui-ux-pro-max` design system generator:
   `python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<domain>" --design-system -p "<ProjectName>" --format markdown`
3. Enforce `.agents/skills/anti-ai-ui/SKILL.md` craft standards (zero emojis, zero sparkles, contextual navigation, tactile affordances, authentic domain data).
4. Author or update `DESIGN.md` at the project root following the Dev-OS design specification schema.
5. Audit with `.agents/scripts/ui-taste-check.sh` and request QA verification.
6. Once approved, unblock frontend UI component development.
