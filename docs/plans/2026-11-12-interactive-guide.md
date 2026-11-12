# Plan: the interactive guide and stakeholder presentation page (v5.3.0)

Status: APPROVED by the human on 2026-11-12 (location, gate severity and release answered).

## Goal

Every project Dev-OS builds gets a login-free, interactive page that teaches the project
end to end, can be driven live in front of stakeholders with next/previous navigation, and
carries the demo credentials needed to follow along. Dev-OS generates it and keeps it
current without being asked.

The human's words: "whenever a project is built there should be a testing guide or
documentation page, accessible without login that page should teach me everything i need
and give me step by step presentation of the system that i can use to present to
stakeholder. with next and previous button, interactive, and with demo data credentials.
and whenever theres update that page should also be updated, like the guide in the docs. it
should be a page where users can use to test and learn about the project and also use for
presentations to stakeholders, end to end guide test for all use cases. devos must handle
this automatically."

## What already exists (verified in the tree on 2026-11-12)

The content contract is built and mandated. Only the page and the automation are missing.

- `.agents/skills/testing-guide/SKILL.md` fixes the deliverable (`docs/TESTING_GUIDE.md`),
  the universal test password `devos123`, four standard personas
  (`admin@example.com`, `user@example.com`, `member@example.com`, `guest@example.com`), and
  a required section structure: Quick Start, Seed Data Fixtures, Test Scenarios as `###`
  blocks of `- [ ]` steps, Known Limitations.
- `.agents/agents/tester.md:22` makes the Tester the author; `.agents/agents/qa.md:37`
  checks it at delivery; `.agents/agents/orchestrator.md:85` runs it as Phase 6 and
  `:87` hands it to the founder in Phase 8; `.agents/commands/auto.md:17` does the same for
  `devos run`.
- `.agents/AGENTS.md:537` carries it as Hard Rule 17 (universal test credentials).
- `bin/devos.js:5521` already lists the guide in `devos doctor`, and `:5710` in
  `devos status`, both as optional.
- `.agents/skills/autonomous-sdlc/SKILL.md:41` lists it as a required autonomous-mode
  artifact.

So the markdown is already written by an agent, already humanizer-gated, already part of
every delivery. This plan derives the page from it rather than inventing a second content
store that would drift from the first.

## Decisions (mine unless marked)

1. **One source of truth: `docs/TESTING_GUIDE.md`.** The page is generated output, never
   hand-edited. A second authored artifact would drift, and the markdown is what agents
   already produce and the pre-commit humanizer already checks.
2. **Output: the app's own public directory** (human's call), one self-contained file. No
   build step, no runtime dependency, no network fetch, no login. It deploys with the app, so
   stakeholders open a URL rather than a file. Honours R12.
   Resolution order, recorded in `.agents/manifest.json` under `guide.path` so every later
   command agrees without re-detecting:
   1. `--out <path>` when given.
   2. An existing `public/` (nextjs, laravel, express) or `static/` (django, fastapi).
   3. The conventional directory for the configured stack, created if absent.
   4. `docs/guide/` when the stack has no web root (react-native) or nothing matches.
   The file lands at `<root>/guide/index.html`, so it never collides with an app route named
   `guide.html` and can be deployed or excluded as one directory.
3. **The page source lives in `bin/devos.js`** as a `guidePageSource()` template function,
   exactly like the existing `openCodePluginSource()`. Two reasons: the CLI must stay
   zero-dependency, and R15 blocks editing `*.html` without a `DESIGN.md`, which would make
   a checked-in HTML template unmaintainable in this repo.
4. **The markdown subset the parser accepts** is only what the skill's structure uses:
   `##`/`###` headings, `- [ ]` task items, ordered and bullet lists, pipe tables, fenced
   code, and inline code/bold/links. Anything unrecognised passes through as a paragraph,
   so a Tester writing prose never breaks the build.
5. **Model:** `##` sections become chapters, each `###` scenario becomes a slide, and each
   `- [ ]` becomes a numbered step inside it. Quick Start and Seed Data become the opening
   slides; Known Limitations becomes the closing one.
6. **Freshness is a recorded hash, not a timestamp.** The generated page embeds the SHA-256
   of the markdown it came from. `devos guide --check` recomputes and exits non-zero when
   they differ. Timestamps produce false staleness on every checkout; a content hash does
   not.
7. **The pre-commit gate blocks** (human's call; gate 7 in
   `.agents/scripts/install-hooks.sh`, after the humanizer). When `docs/TESTING_GUIDE.md` is
   staged and the generated page does not match it, the commit is refused with the exact
   regeneration command. To keep the block from being something people route around, the
   message names one command that fixes it, and the gate fires only when the markdown itself
   is staged, never on unrelated commits.
8. **`devos init` seeds a starter `docs/TESTING_GUIDE.md`** from a new
   `templates/scaffolds/docs/TESTING_GUIDE.md`, so the page exists from the first minute
   rather than appearing only after the first Tester run. The starter carries the four
   personas, the password, and one worked example scenario.
9. **Demo credentials, and the exposure the public directory creates.** The page renders the
   personas and `devos123` from the markdown. The generator refuses to embed any credential
   value that is not `devos123` or an obvious placeholder, and reports it instead, so no real
   secret can reach a generated page (R2 intact).
   Because the page now ships inside the deployed app, `admin@example.com / devos123` is
   readable by anyone who finds the URL. Raised with the human on 2026-11-12; they chose the
   public directory knowingly, since the point is to send stakeholders a link. Mitigations
   that ship with it:
   - a permanent banner naming the environment the guide describes, and saying the seed
     accounts belong to demo data only;
   - `<meta name="robots" content="noindex, nofollow">` so it stays out of search results;
   - `devos guide --check` warns when the page sits in a deployed directory and the project
     has production env markers, pointing at staging instead;
   - the guide directory is one path, so excluding it from a production build is one line.
10. **Coverage against specs.** `devos guide --check` also reads
    `docs/specs/*/requirements.md` and reports any EARS requirement id with no matching
    scenario in the guide. That is what makes "all use cases" verifiable instead of
    aspirational, and it reuses the id conventions `devos spec check` already relies on.

## Non-goals

- No framework, bundler, or CSS library. No React, no Tailwind CDN.
- No server, no auth, no analytics, no telemetry on the page.
- Dev-OS does not run the project's app or capture screenshots. The page tells a human what
  to do; it does not drive the browser.
- No editing of the page by hand, and no round-tripping HTML back into markdown.
- Not a replacement for `docs/TUTORIAL.md` or `GETTING_STARTED.md`, which stay prose.

## Anti-goals (would make this a failure even if it worked)

- A page that looks like generic AI output when a founder puts it on a projector.
- A page that silently rots, so a stakeholder is shown a flow that no longer exists.
- A gate so loud that people disable it.

## Phases

Each phase is TDD: assertions land in `scripts/smoke-test.js` first and fail, then the
implementation makes them pass. Gates per phase: `npm test`, `devos skill audit`,
`npm run eval`, `node scripts/check-conformance.js`.

### W1 — Model and generator

- `parseTestingGuide(markdown)` producing `{ meta, credentials, chapters[], slides[], steps[] }`.
- `devos guide` writes `docs/guide/index.html`; `--out <path>` overrides.
- Exported from `module.exports` for the test suite, matching the existing pattern.
- Tests: the skill's own example structure parses to the expected slide and step counts; an
  unrecognised block degrades to a paragraph; a missing guide exits with a clear message and
  a non-zero code; a credential value other than `devos123` is reported, not embedded.

### W2 — The page

- Next/previous buttons, left/right arrow and space keys, deep links per slide
  (`#scenario-a`), a progress bar, and a slide index that jumps.
- Per-step checkboxes persisted in `localStorage`, wrapped in try/catch, with the page
  rendering correctly when storage throws or is empty. A visible reset.
- A credentials panel, open on every slide, with copy-to-clipboard per value.
- Presenter mode: larger type, chrome and checkboxes hidden, one step per view.
- A print stylesheet so the whole guide exports to PDF in one pass.
- Light and dark via `prefers-color-scheme` with tokens on `:root`, keyboard focus rings,
  `:active` press depression, and SVG icons only.
- Must pass `bash .agents/scripts/ui-taste-check.sh docs/guide/index.html`, since R19 and
  the pre-commit taste gate will scan it in target projects. This is a constraint, not an
  afterthought: the page is the thing stakeholders look at.
- Tests: generated HTML contains the nav controls, the step count matches the model, the
  storage access is guarded, the taste check passes on the generated file.

### W3 — Staying current

- The page embeds `data-source-sha256`; `devos guide --check` compares and exits 1 on drift.
- Pre-commit gate 7 in `install-hooks.sh`: when `docs/TESTING_GUIDE.md` is staged and the
  page is stale, print `[ WARN ]` with the regeneration command.
- `devos update` regenerates the page when one already exists.
- `devos doctor` and `devos status` report present / stale / absent instead of today's
  binary present-or-none.
- Tests: a mutated markdown makes `--check` exit 1; regeneration clears it; the gate text
  appears for a staged guide; `update` refreshes an existing page and does not create one
  where none existed.

### W4 — Coverage against the specs

- `devos guide --check` reports EARS requirement ids in `docs/specs/*/requirements.md` with
  no scenario covering them.
- Tests: a spec requirement with no scenario is reported; one covered by a scenario is not;
  a project with no `docs/specs/` is silent rather than failing.

### W5 — Wiring and docs

- `templates/scaffolds/docs/TESTING_GUIDE.md` and its install at init, plus `devos scaffold`.
- Tester, QA and orchestrator personas gain the one line that says to run `devos guide`
  after writing the markdown; `.agents/commands/test.md` and `auto.md` Phase 6/8 likewise.
- `.agents/AGENTS.md` Hard Rule 17 extended to name the generated page.
- `templates/docs/TUTORIAL.md` and `GETTING_STARTED.md` gain a short section.
- `.agents/skills/testing-guide/SKILL.md` gains the generation step and bumps its metadata
  version.
- `CHANGELOG.md` and the `5.3.0` version bump across `package.json` and the CLI banner.
- Tests: every persona that owns the deliverable mentions the command; the scaffold installs;
  the init summary names the page.

## Risks

- **Markdown drift.** A Tester who ignores the skill's structure produces a thin page. The
  parser degrades rather than failing, and `--check` reports unparsed scenarios so the gap is
  visible.
- **The taste gate.** The generated page is itself frontend UI, so a careless template fails
  R19 in every target project at once. W2 treats the taste check as an acceptance test.
- **R15.** Target projects block `*.html` writes without `DESIGN.md`. The CLI writes the page
  with `fs.writeFileSync`, not through an agent tool call, so the hook does not fire; W2
  confirms this in a generated project rather than assuming it.
- **Scope.** W4's coverage check is the piece most likely to grow. If it does, it ships as
  report-only and the enforcement waits.

## Answered by the human (2026-11-12)

1. **Location:** the app's own public directory, not `docs/`. Folded into decision 2.
2. **Gate severity:** block, refuse the commit. Folded into decision 7.
3. **Release:** `5.3.0`. GitHub is where users currently take Dev-OS from, since npm still
   sits at 5.1.2; the human publishes 5.2.0 and 5.3.0 to npm after this lands.

## Next after this

The human asked, once 5.3.0 is done, to research what is happening in the industry and bring
back a proposal for the following update. That is a separate piece of work, started
immediately after this one ships.
