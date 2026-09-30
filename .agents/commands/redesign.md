---
name: redesign
description: Orchestrate multi-agent UI redesign refactoring existing frontend components to match updated DESIGN.md
agent: orchestrator
triage_level: STANDARD
workflow: standard
---

Execute the Multi-Agent UI Redesign Workflow:

When the project root `DESIGN.md` is updated or replaced with a new brand design system:

1. **Gate Audit (QA Agent):**
   - Verify `./DESIGN.md` contains valid color tokens, typography scales, component definitions, and anti-patterns.
   - Run `.agents/scripts/ui-taste-check.sh` pre-check.

2. **Component Token Refactoring (Developer Agent):**
   - Inspect existing frontend files (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.html`, `*.css`).
   - Refactor visual layers: colors, typography, border-radius, shadows, buttons, cards, and navigation to match `./DESIGN.md`.
   - **Strict Preservation Boundary**: Never alter business logic, state management, API routes, database queries, or server actions.

3. **Interactive & Regression Testing (Tester Agent):**
   - Test responsive layout across breakpoints (mobile 375px, tablet 768px, desktop 1024px+).
   - Test interactive states (hover, active, focus-visible rings).
   - Run the existing test suite (`npm test`) to guarantee zero regression.

4. **Standards & Contrast Verification (QA Agent):**
   - Validate WCAG AA contrast (minimum 4.5:1 for body text).
   - Confirm zero raw emojis as icons, zero sparkle embellishments, and zero AI clichés.
   - Issue **APPROVED** or **CHANGES REQUESTED**.

5. **Human Checkpoint & Staged Review:**
   - Present a concise diff summary of refactored components to the human.
   - User verifies in browser and triggers commit via `.agents/scripts/commit.sh`.
