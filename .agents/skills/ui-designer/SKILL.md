---
name: ui-designer
description: Craft one-of-a-kind, ship-ready frontend interfaces with elevated design quality. Apply this skill whenever the user wants to build web components, pages, artifacts, posters, or applications (for example, websites, landing pages, dashboards, React components, HTML/CSS layouts, or any task that involves styling or beautifying a web UI). Produces inventive, refined code and UI design that sidesteps cookie-cutter AI aesthetics.
license: Complete terms in LICENSE.txt
---

Use this skill to produce singular, deployment-ready frontend interfaces that escape the bland "AI slop" look. Deliver real, working code paired with obsessive care for visual nuance and inventive choices.

Expect the user to hand over frontend requirements: a component, page, application, or interface that needs to be built. Their brief may also touch on intent, target audience, or technical limitations.

## Setting the Visual Direction

Do not start coding until you've absorbed the context and committed to a DARING visual direction. Work through these four questions first:

- **Purpose** — Which problem is this interface tackling, and who will be using it?
- **Tone** — Pick something extreme: ruthlessly minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian — and many more besides. Treat these flavors as launchpads, then craft a version that genuinely embodies the direction you've picked.
- **Constraints** — The technical boundaries you must operate inside (framework, performance, accessibility).
- **Differentiation** — What turns this into something UNFORGETTABLE? Which single element will stick in someone's memory?

**CRITICAL**: Settle on one unambiguous conceptual direction and execute it with precision. Audacious maximalism and pared-back minimalism are both valid — what matters is deliberateness, not loudness.

## The Bar for Shipped Output

Whatever you build (HTML/CSS/JS, React, Vue, or similar) must be:

- Production-ready and operational
- Striking enough to stick in memory
- Anchored in a single, intentional aesthetic point of view
- Polished obsessively down to the smallest detail

## Levers of Craft

Concentrate on:

- **Typography** — Pick fonts that are striking, distinctive, and full of personality. Don't fall back on commonplace stacks like Arial and Inter; instead, select unconventional typefaces with real character that lift the interface — surprising, characterful choices. Pair a memorable display face with a refined body face.
- **Color & Theme** — Commit to a unified visual identity. Rely on CSS variables to keep everything coherent. A bold dominant color punctuated by crisp accents will outperform a flat, evenly-weighted palette every time.
- **Motion** — Use animation for effects and micro-interactions. For raw HTML, prefer CSS-only solutions first. In React, use the Motion library when it's available. Concentrate animation on high-impact moments: one carefully choreographed page entrance with staggered reveals (via animation-delay) creates more delight than a smattering of tiny touches. Add scroll-triggered transitions and hover states that surprise.
- **Spatial Composition** — Layouts that defy expectation. Asymmetry. Overlapping forms. Diagonal flow. Components that crack the grid. Lavish whitespace OR controlled density.
- **Backgrounds & Visual Details** — Build atmosphere and depth instead of defaulting to flat colors. Add contextual effects and textures that echo the broader aesthetic. Employ inventive treatments such as gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

## Aesthetics to Reject

NEVER fall back on stock AI-styled aesthetics: the worn-out font stacks (Inter, Roboto, Arial, system fonts), tired color combinations (purple gradients over white backgrounds being a notorious offender), predictable layout and component templates, or assembly-line designs that ignore the specific context.

Read the brief imaginatively and make surprising decisions that feel authentically crafted for the situation at hand. No two designs should look alike. Rotate between light and dark themes, between different typefaces, between different aesthetic registers. NEVER settle into the same safe defaults (Space Grotesk, for instance) across multiple generations.

## Calibrating Effort to Vision

**IMPORTANT**: Scale code complexity to fit the aesthetic intent. Maximalist work demands rich code thick with animation and effects. Minimalist or refined work demands discipline, precision, and meticulous attention to spacing, typography, and quiet details. Elegance emerges from executing the vision faithfully.

Keep in mind: Claude is capable of remarkable creative output. Don't play it safe — show what becomes possible when you step outside convention and fully commit to a singular vision.

## Picking Contextual Imagery

Bundled with this skill is a script at `scripts/find-relevant-image.py` that selects a contextually fitting image from a curated, static database. It compares your description against the tags stored beside each image to identify the best match, while keeping the underlying resources current by checking if the installed skill is at the latest version, and prompting the user if update is available.

The image catalog lives in `assets/images.csv` with columns `image-id`, `filename`, `tags`, and `image-base64`. For each entry, the script tallies how many of its tags appear in your description, selects the top scorer, verifies the decoded file via the `file` command, and saves it into the output directory. The output filename is dictated by the image metadata — the caller does not supply it.

### Invocation

```bash
python scripts/find-relevant-image.py "<description>"
```

**Arguments:**
- `description` - A description of where and how the image will be used (e.g. `"hero banner for a travel blog about Japanese temples"`)

The selected image lands in `scripts/outputs/` (auto-created if missing). The complete output path is printed to stdout.

**Example:**
```bash
python scripts/find-relevant-image.py "warm, inviting background photo for a bakery landing page"
# Output: Matched image 'img-1234' written to /path/to/scripts/outputs/temple-landscape.png
```

Invoke this script whenever a frontend design calls for a real image rather than a placeholder — it locates one that fits the design context instead of dropping in a generic stock photo.
