---
name: design
description: Extract design tokens and archetype from ui-ux-pro-max and author DESIGN.md at project root
agent: ui-designer
triage_level: STANDARD
workflow: standard
---

Execute the Mandatory Design Gate workflow:

1. Analyze project domain (SaaS, dev tool, mobile, dashboard, landing page, consumer).
2. Run `ui-ux-pro-max` search script if available to extract color palettes, typography systems, and spacing rules.
3. Author or update `DESIGN.md` at the project root following the Dev-OS design specification schema.
4. Request QA verification of contrast, accessibility, and visual hierarchy.
5. Once approved, unblock frontend UI component development.
