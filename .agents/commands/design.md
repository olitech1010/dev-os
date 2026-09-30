---
name: design
description: Match authentic brand design systems from catalog (VoltAgent/awesome-design-md) and apply DESIGN.md at project root
agent: ui-designer
triage_level: STANDARD
workflow: standard
---

Execute the Mandatory Design Gate workflow:

1. Analyze project domain (SaaS, developer tool, mobile, dashboard, fintech, e-commerce, consumer).
2. Match and apply design system from the 74-brand catalog:
   - Interactive matching: `devos design match "<domain keywords>"`
   - Direct application: `devos design apply <id>` (e.g. `linear`, `stripe`, `supabase`, `vercel`, `airbnb`)
3. Enforce `.agents/skills/anti-ai-ui/SKILL.md` craft standards (zero emojis, zero sparkles, contextual navigation, tactile affordances, authentic domain data).
4. Verify `./DESIGN.md` at project root with `.agents/scripts/ui-taste-check.sh` and request QA audit.
5. Once approved, unblock frontend UI component development.
