---
name: design
description: UI/UX design principles and core philosophy. Defines typography, color, layout, spacing, and interaction states. Use when an agent is working on UI, design systems, or visual components.
---

# Design Skill — AI Agent Design Principles

> Load this when an agent is working on UI, design systems, or visual components.
> This defines how we think about design — not just what things look like, but why.

---

## Core Philosophy

Design is not decoration. Every visual decision should make the product easier to understand and use. When in doubt, remove something rather than add it.

---

## Before Touching Any UI

1. **Understand the user's job.** What are they trying to accomplish? Design for that task, not the technology behind it.
2. **Read the existing design system.** Match existing components before creating new ones. Every new component is maintenance debt.
3. **Name things as users know them.** Not "webhook configuration" — "notification settings". Not "auth token" — "your API key".

---

## Typography

- Define a type scale before building. Don't pick font sizes ad hoc.
- Maximum 2 font families per product (display + body). Add a mono face only if showing code.
- Line length: 60-75 characters for body text. Wider than this hurts readability.
- Line height: 1.5 for body, 1.2-1.3 for headings.

Suggested scale:
```
xs: 12px
sm: 14px
base: 16px
lg: 18px
xl: 20px
2xl: 24px
3xl: 30px
4xl: 36px
```

---

## Color

- Build with semantic tokens, not raw hex values in components.
  - `color-primary` not `#3B82F6`
  - `color-danger` not `#EF4444`
  - `color-text-muted` not `#6B7280`
- Every color must pass WCAG AA contrast (4.5:1 for text, 3:1 for large text and UI elements)
- Dark mode: design both modes from the start — retrofitting is painful
- Don't use color alone to convey meaning (for accessibility)

---

## Layout & Spacing

- Use a spacing scale (4px base unit is standard): 4, 8, 12, 16, 24, 32, 48, 64
- Consistent internal spacing within components, consistent spacing between components
- White space is a design element — use it deliberately, not to fill gaps
- Mobile-first: design for the smallest screen that matters, then enhance

---

## Components

### Writing Component Copy
- Labels label — they say what the field is, not instructions
- Placeholders are examples, not labels — they disappear on focus
- Buttons say what happens: "Save changes", not "Submit"
- Error messages say what went wrong and how to fix it: "Email already registered — try logging in"
- Empty states invite action: "No cases yet — report the first one"

### Interaction States
Every interactive component must have:
- Default
- Hover
- Focus (keyboard-navigable, visible outline)
- Active / pressed
- Disabled (with explanation if not obvious why)
- Loading (if async)
- Error (if validation applies)

---

## Accessibility Non-Negotiables

- All images have meaningful `alt` text (or `alt=""` if decorative)
- All forms have `<label>` elements associated with inputs
- Focus order follows visual order
- Interactive elements are reachable by keyboard
- Don't rely on hover alone to reveal information
- Minimum touch target size: 44x44px on mobile

---

## Animation

- Animation should serve the interface — transitions, loading states, feedback
- Never animate for decoration alone
- Respect `prefers-reduced-motion` — always provide a no-motion alternative
- Duration guide:
  - Micro-interactions (hover, toggle): 100-200ms
  - Page transitions: 200-350ms
  - Loading / skeleton states: match expected wait time

---

## Forbidden Patterns

- Placeholder text as the only label (disappears when user types)
- Tooltips on mobile (no hover on touch)
- Auto-playing video or audio
- Disabling paste in password fields
- Infinite scroll without a way to reach the footer
- Carousels that auto-advance
- Hiding content behind hover on mobile
- Modals that block users from copying text (e.g. phone numbers, addresses)

---

## Design Tokens (Start Every Project With These)

```css
:root {
  /* Colors — replace with your brand */
  --color-primary: ;
  --color-primary-hover: ;
  --color-danger: ;
  --color-success: ;
  --color-warning: ;
  --color-text: ;
  --color-text-muted: ;
  --color-background: ;
  --color-surface: ;
  --color-border: ;

  /* Typography */
  --font-display: ;
  --font-body: ;
  --font-mono: ;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```


