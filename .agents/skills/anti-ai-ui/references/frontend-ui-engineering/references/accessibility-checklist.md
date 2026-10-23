# Accessibility Checklist (WCAG 2.2 AA, condensed)

Run through this before handing UI work to QA. It is a floor, not a full audit.

## Structure and semantics
- [ ] One `<h1>` per page; headings descend without skipping levels.
- [ ] Landmarks used: `<header>`, `<nav>`, `<main>`, `<footer>`; one `<main>`.
- [ ] Native elements first: `<button>` for actions, `<a href>` for navigation. No clickable `<div>`.
- [ ] Lists use `<ul>`/`<ol>`; data tables use `<th>` with `scope`.
- [ ] `<html lang>` is set.

## Keyboard
- [ ] Every interactive element is reachable with Tab and operable with Enter/Space.
- [ ] Focus order follows visual order; no positive `tabindex`.
- [ ] Visible `:focus-visible` indicator with at least 3:1 contrast.
- [ ] Dialogs trap focus, close on Escape, and return focus to the trigger.
- [ ] A skip link reaches the main content.

## Forms
- [ ] Every input has a programmatic label (`<label for>` or `aria-labelledby`); placeholders are not labels.
- [ ] Errors are announced (`aria-describedby` plus `aria-invalid`) and say how to fix the problem.
- [ ] Correct `type` and `autocomplete` attributes are set.

## Color, text, and motion
- [ ] Text contrast at least 4.5:1 (3:1 for large text and UI components).
- [ ] Color is never the only carrier of meaning.
- [ ] Layout survives 200% zoom and 320px width without horizontal scrolling.
- [ ] `prefers-reduced-motion` disables non-essential animation.
- [ ] Touch targets are at least 24x24 CSS px (44x44 recommended).

## Media and dynamic content
- [ ] Informative images have meaningful `alt`; decorative images use `alt=""`.
- [ ] Icon-only buttons have an accessible name (`aria-label`).
- [ ] Async updates use an `aria-live` region; loading states are announced.
- [ ] Video has captions; audio has a transcript.

## Testing tools
- Automated: axe DevTools or `@axe-core/playwright`, Lighthouse accessibility audit, `eslint-plugin-jsx-a11y`.
- Manual: keyboard-only pass, a screen reader pass (VoiceOver, NVDA), and 200% zoom.
- Automated tools catch roughly a third of issues; the manual pass is required.
