---
name: anti-ai-ui
description: Compulsory UI/UX craft standard that eliminates AI-generated UI clichés ("AI slop") and enforces authentic frontend design. Bans emojis as icons, sparkle embellishments, cookie-cutter profile pills, lazy indigo-purple gradients, generic "Holy Trinity" card layouts, and placeholder data. Enforces tactile affordances, distinctive typography, authentic domain entities, and intentional layout hierarchy.
---

# Anti-AI UI & Distinctive Craft Standard

This skill is a **compulsory standard** for the UI Designer, Developer, and QA agents. It provides a definitive catalog of low-effort AI-generated UI patterns ("AI slop") and enforces human-grade craftsmanship, tactile feedback, and authentic domain design.

Every frontend UI component, page, or layout authored in Dev-OS must adhere to these rules and pass the mechanical audit script:
```bash
bash .agents/scripts/ui-taste-check.sh [path]
```

---

## The 7 Pillars of Distinctive UI Craft

1. **Vector-Only Functional Iconography**: 100% cohesive SVGs (Lucide, Heroicons, Radix). Zero emojis in functional UI. Zero decorative sparkle icons.
2. **Context-Aware Navigation & Profiles**: Bespoke workspace/user menus with dropdown popovers, status indicators, and keyboard navigation. No stereotyped 32px circle + email + naked door logout pill.
3. **Domain-Grounded Color & Elevation**: Palettes derived from the project's industry via `ui-ux-pro-max`. Intentional surface elevation (`--surface-base`, `--surface-raised`, `--surface-overlay`) instead of uniform pitch-black glassmorphism.
4. **Asymmetrical & Purposeful Layouts**: Bento grids with varied visual weight, split views, and distinct focal points. No assembly-line 3-card grids where every card looks identical.
5. **Authentic Domain Entities**: Realistic data, terminology, numbers, and timestamps suited to the specific product (e.g., restaurant POS, fintech ledger, developer logs). Never use "John Doe" or "Lorem Ipsum".
6. **Tactile Interactive Affordances**: Buttons visibly compress on click (`active:scale-[0.98]`), clickable cards display `cursor-pointer`, and all focusable elements feature high-contrast `focus-visible` rings.
7. **Actionable Empty States & Dense Tables**: Empty states provide 1-click templates and sample data. Tables feature hover row highlights, sort indicators, pagination, and sticky headers.

---

## Catalog of 20 AI UI Anti-Patterns & Counter-Patterns

### 1. Emojis Used as Functional UI Icons
- ❌ **The AI Tell**: Dropping emojis into navigation, buttons, or cards (`<span>🚀 Launch</span>`, `<span>💡 Tips</span>`, `<span>⚡ Features</span>`, `<span>🔥 Trending</span>`). Emojis render inconsistently across operating systems, clash with custom typography, and look juvenile.
- ✅ **The Fix**: Use monochromatic, uniform SVGs from a single icon library (Lucide or Heroicons) with explicit `aria-hidden="true"`.
  ```tsx
  // BAD
  <button>🚀 Deploy App</button>

  // GOOD
  <button className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500 active:scale-[0.98]">
    <Rocket className="h-4 w-4" aria-hidden="true" />
    <span>Deploy Application</span>
  </button>
  ```

---

### 2. The Sparkle / Magic Wand Cliché
- ❌ **The AI Tell**: Slapping `Sparkles`, `✨`, or `Wand2` on every search bar, button, pill badge, or card header as a lazy substitute for visual design.
- ✅ **The Fix**: Use descriptive text labels, functional status badges (e.g. `Automated`, `Predictive`, `Beta`), or domain-specific iconography. If an automated action exists, describe what it does instead of dressing it in glitter.

---

### 3. The Cookie-Cutter Sidebar Profile Pill
- ❌ **The AI Tell**: In the bottom-left sidebar, an isolated 32px circular avatar with two lines of truncated text (bold username, grey 12px email) and a floating naked logout door icon.
- ✅ **The Fix**: Design an integrated user account menu or workspace switcher:
  - An interactive popover button with a subtle chevron (`ChevronsUpDown`).
  - Active workspace name and role badge (e.g., `Owner`, `Admin`, `Staff`).
  - Opens an accessible dropdown with keyboard navigation (`Settings`, `Billing`, `Keyboard Shortcuts`, `Sign out`).

---

### 4. The Lazy Indigo-to-Purple Gradient
- ❌ **The AI Tell**: Defaulting to `bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500` on buttons, borders, and text masks (`bg-clip-text text-transparent`).
- ✅ **The Fix**: Anchor the color palette in the project's actual industry (e.g., warm terra-cotta `#DC2626` and gold `#A16207` for food/hospitality; crisp forest green `#15803D` for fintech; steel slate `#334155` for developer tools). Use solid, high-contrast headings that pass WCAG AA (4.5:1 minimum).

---

### 5. Pitch-Black Glassmorphism Everywhere
- ❌ **The AI Tell**: Setting the background to `#09090b` or `#000000` and slapping `bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl` on every card, modal, and navbar with zero elevation hierarchy.
- ✅ **The Fix**: Establish a clear 3-tier surface elevation system:
  - Base layer: `--surface-base` (`#0f172a` or `#f8fafc`)
  - Raised cards: `--surface-raised` (`#1e293b` or `#ffffff`) with physical subtle borders (`border-slate-200 dark:border-slate-800`)
  - Overlay/Modals: `--surface-overlay` with directional drop shadows (`shadow-sm`, `shadow-md`)

---

### 6. The "Holy Trinity" Feature Card Grid
- ❌ **The AI Tell**: Exactly 3 identical cards side-by-side, each with a 48x48 rounded squircle containing a colored icon, a 2-word title ("Blazing Fast"), 2 lines of generic copy, and "Learn more →".
- ✅ **The Fix**: Build an asymmetric Bento Grid:
  - One primary hero feature card spanning 2 columns with interactive preview or data visualization.
  - Two secondary vertical cards with high-density metrics or quick-action triggers.
  - Vary visual density, card sizes, and content types across sections.

---

### 7. The Cliché SaaS Hero Banner
- ❌ **The AI Tell**:
  1. Pill badge with sparkle: `✨ Announcing 2.0 →`
  2. H1: `Supercharge your workflow with the all-in-one AI platform`
  3. Two buttons: giant purple `Get Started` + outlined `Watch Demo (1:30)`
  4. A giant floating purple radial blur behind the section
- ✅ **The Fix**: Write a problem-first, product-specific headline. Show real screenshots, interactive terminals, or live workflows instead of abstract blurred gradient blobs.

---

### 8. Generic Metric Cards with Fake "+12.4%" Badges
- ❌ **The AI Tell**: Four identical metric cards across the top of a dashboard ("Total Revenue", "Active Users", "Conversion Rate", "Bounce Rate"), all displaying a canned green pill `+12.4% vs last month`.
- ✅ **The Fix**: Tailor metrics strictly to the product domain. For a restaurant POS:
  - "Open Tables: 14 / 22" (with occupancy bar)
  - "Today's Gross Sales: $3,420.50" (with hourly order sparkline)
  - "Kitchen Ticket Queue: 4 pending" (with wait time warning badge)
  - "Top Dish: Wild Mushroom Risotto (18 sold)"

---

### 9. Missing Button Press Affordance (`:active` Depression)
- ❌ **The AI Tell**: Buttons that change background color on hover but remain completely static when clicked, feeling mushy and unresponsive.
- ✅ **The Fix**: Include tactile physical depression:
  ```tsx
  className="transition-all duration-150 ease-out active:scale-[0.98] active:brightness-95"
  ```

---

### 10. Missing High-Contrast Focus Visible Rings
- ❌ **The AI Tell**: Using `outline-none` or `focus:outline-none` without replacing it with an accessible focus indicator.
- ✅ **The Fix**: Always provide visible keyboard focus rings:
  ```tsx
  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
  ```

---

### 11. Static Dead Tables
- ❌ **The AI Tell**: A plain HTML table with no row hover highlighting, no sortable column indicators, no pagination, and arbitrary column widths.
- ✅ **The Fix**:
  - Interactive row hover (`hover:bg-slate-50 dark:hover:bg-slate-800/50`).
  - Sort indicators (`ArrowUpDown`, `ArrowUp`, `ArrowDown`) on headers.
  - Sticky table headers (`sticky top-0 bg-surface`).
  - Clear pagination controls with total count ("Showing 1–25 of 142 orders").

---

### 12. The Vacuous Empty State
- ❌ **The AI Tell**: A giant sad grey folder or magnifying glass in the center of the page with "No data found" and a generic "Add Item" button.
- ✅ **The Fix**: Make empty states educational and helpful:
  - Provide 2–3 pre-configured starter templates (e.g. "Load sample menu", "Import CSV", "Create custom item").
  - Show a ghosted skeleton preview of what the screen will look like when populated.

---

### 13. Lazy Placeholder Entities
- ❌ **The AI Tell**: Using "John Doe", "john@example.com", "Acme Inc.", "$1,234.56", and "Lorem ipsum dolor sit amet" throughout UI mocks.
- ✅ **The Fix**: Generate authentic, believable domain entities:
  - Restaurant POS: "Elena Vance (Server)", "Table 4 - Patio", "2x Truffle Gnocchi", "$46.00".
  - Developer Tools: `api-gateway-prod-01`, `us-east-1`, `24ms latency`, `GET /v1/checkout`.

---

### 14. Floating Blurry Radial Blobs
- ❌ **The AI Tell**: Strewing `absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-[120px]` across backgrounds to fake depth.
- ✅ **The Fix**: Use structured CSS grid patterns, subtle geometric noise textures, fine 1px border grids, or authentic photography.

---

### 15. All-Caps Letterspaced Overkill
- ❌ **The AI Tell**: Applying `text-xs uppercase tracking-widest text-zinc-400 font-semibold` to every single section title, card header, and table column.
- ✅ **The Fix**: Reserve uppercase tracking strictly for tiny status indicators or code identifiers. Use title case or sentence case for human-readable headings.

---

### 16. Missing `cursor-pointer` on Clickable Cards
- ❌ **The AI Tell**: Making an entire card or row clickable via `onClick` without adding `cursor-pointer` and interactive hover styles.
- ✅ **The Fix**: Ensure every interactive surface displays `cursor-pointer`, hover border/shadow lift, and keyboard focusability.

---

### 17. Instant Pop-in Without Skeleton Loaders
- ❌ **The AI Tell**: Showing a blank white screen or jumping layout when data arrives, causing Cumulative Layout Shift (CLS).
- ✅ **The Fix**: Provide pulse skeleton loaders that exactly match the geometry of the target card, table, or avatar.

---

### 18. Center-Aligned Long Body Copy
- ❌ **The AI Tell**: Centering 4–5 lines of body paragraph text (`text-center max-w-2xl mx-auto`), which degrades reading speed and accessibility.
- ✅ **The Fix**: Only center single-line taglines or titles. Always left-align multi-line explanatory body copy for natural left-edge scanning.

---

### 19. Inconsistent Icon Stroke Weights
- ❌ **The AI Tell**: Mixing a thick 2.5px filled icon with a fragile 1px stroke icon in the same interface.
- ✅ **The Fix**: Standardize on a single icon weight across the entire design system (e.g. `strokeWidth={1.75}`).

---

### 20. Meaningless Floating Pill Chips
- ❌ **The AI Tell**: Pinning random pills (`New!`, `Trending`, `Featured`) with absolute positioning into arbitrary corners of images or cards.
- ✅ **The Fix**: Place metadata badges inline within the card's natural header or footer flow with consistent alignment.

---

## Pre-Delivery Verification Checklist

Before submitting frontend code to QA, the developer must verify:
- [ ] No emojis in JSX/HTML templates (use Lucide/Heroicons SVG).
- [ ] No `Sparkles` or magic wand icons used as decorative crutches.
- [ ] Profile and navigation components are contextual, accessible dropdowns/switchers.
- [ ] Color palette is grounded in the project archetype from `ui-ux-pro-max`.
- [ ] All buttons have `:active` depression (`active:scale-[0.98]`).
- [ ] All inputs and interactive elements have high-contrast `focus-visible` rings.
- [ ] All mock data uses realistic domain entities (no "John Doe" or "Acme").
- [ ] Run `bash .agents/scripts/ui-taste-check.sh` and ensure 0 violations.
