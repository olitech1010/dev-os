# Third-Party Notices

Dev-OS bundles agent skills adapted from third-party open-source projects. This file lists each vendored skill, where it came from, and its license. Dev-OS changes vendored skills: it edits descriptions, routes commits through `.agents/scripts/commit.sh`, adds human-confirmation steps, splits large files into `references/`, and merges overlapping skills.

The license texts these licenses require to travel with the material are in `.agents/licenses/`. Read that directory's README first; it says which text covers what.

Verification (October 2026): "Verified" means the upstream repository was fetched and its LICENSE file read, and the local copy was compared against the upstream text. "Declared only" means the upstream states a license in its README or package metadata but ships no LICENSE file. "Unresolved" means the origin could not be established. If you are an upstream author and see an error, please open an issue at https://github.com/olitech1010/dev-os/issues.

Paths are relative to `.agents/skills/`. A path under `<skill>/references/<name>/` is a skill that was merged into `<skill>` in Dev-OS 5.0. The old name still resolves through the `aliases` map in `.agents/packs.json`.

## Verified

| Skill (path) | Upstream | License | Notes |
|---|---|---|---|
| agent-browser | https://github.com/vercel-labs/agent-browser | Apache-2.0 | |
| brainstorming | https://github.com/obra/superpowers | MIT | Copyright (c) 2025 Jesse Vincent |
| writing-plans | https://github.com/obra/superpowers | MIT | Adapted for the Dev-OS plan gate |
| content-strategy | https://github.com/coreyhaines31/marketingskills | MIT | |
| image | https://github.com/coreyhaines31/marketingskills | MIT | |
| image/references/imagegen-frontend-web | https://github.com/Leonxlnx/imagegen-skills | MIT | Previously in Leonxlnx/taste-skill (MIT). Split into references/ |
| image/references/image-generation | https://github.com/claude-office-skills/skills | MIT | Byte-identical to upstream; the local `license: MIT` frontmatter is upstream's own |
| imagegen | https://github.com/openai/skills | Apache-2.0 | License from the bundled `LICENSE.txt`; that repository licenses per skill directory, not repository-wide. The upstream path (`skills/.system/imagegen`) was confirmed only through third-party catalogs |
| skill-creator | https://github.com/anthropics/skills | Apache-2.0 | License from the bundled `LICENSE.txt`; that repository licenses per skill directory, not repository-wide |
| anti-ai-ui/references/ui-designer | https://github.com/anthropics/skills (`frontend-design`) | Apache-2.0 | The suspicious `find-relevant-image.py` section was removed in wave 1 |
| code-reviewer | https://github.com/google-gemini/gemini-cli (`.gemini/skills/code-reviewer`) | Apache-2.0 | Body is verbatim upstream; only the description was reworded. Attribution added in 5.1.1 |
| find-skills | https://github.com/vercel-labs/skills | MIT | Copyright (c) 2026 Vercel, Inc. |
| expose-localhost | https://github.com/ngrok/skills | MIT | Repo was `ngrok/agent-skills`, now redirects to `ngrok/skills` |
| google-agents-cli-adk-code | https://github.com/google/agents-cli | Apache-2.0 | 5 sibling skills are not shipped |
| google-agents-cli-workflow | https://github.com/google/agents-cli | Apache-2.0 | 5 sibling skills are not shipped |
| humanizer | https://github.com/blader/humanizer | MIT | Copyright (c) 2025 Siqi Chen. Rewritten for Dev-OS (v3) |
| laravel-security | https://github.com/affaan-m/ECC | MIT | Repo was `affaan-m/everything-claude-code`. Split into references/ |
| laravel-tdd | https://github.com/affaan-m/ECC | MIT | Split into references/ |
| laravel-verification | https://github.com/affaan-m/ECC | MIT | |
| backend-dev-guidelines/references/backend-patterns | https://github.com/affaan-m/ECC | MIT | Upstream frontmatter also carries `metadata.origin: ECC`, confirming the label |
| laravel-specialist | https://github.com/Jeffallan/claude-skills | MIT | Upstream LICENSE gives a year but no name |
| nextjs-developer | https://github.com/Jeffallan/claude-skills | MIT | |
| nextjs-developer/references/nextjs-app-router-patterns | https://github.com/wshobson/agents | MIT | Copyright (c) 2024 Seth Hobson |
| backend-dev-guidelines/references/nodejs-backend-patterns | https://github.com/wshobson/agents | MIT | |
| backend-dev-guidelines/references/backend-development | https://github.com/MoizIbnYousaf/ai-agent-skills | MIT | Byte-identical to MoizIbnYousaf; its frontmatter declares `wshobson/agents` upstream, but the text is not in that repo. Both are MIT |
| modern-web-guidance | https://github.com/GoogleChrome/modern-web-guidance | Apache-2.0 | The self-declared mandate and the unpinned `npx -y ...@latest` were removed in wave 1 |
| shadcn-ui | https://github.com/google-labs-code/stitch-skills (`plugins/stitch-build/skills/shadcn-ui`) | Apache-2.0 | License at repository level |
| supabase | https://github.com/supabase/agent-skills | MIT | |
| supabase-postgres-best-practices | https://github.com/supabase/agent-skills | MIT | |
| ui-ux-pro-max | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | MIT | Copyright (c) 2024 Next Level Builder. Optional `design-data` pack |
| grill-me/references/grill-with-docs | https://github.com/mattpocock/skills | MIT | Copyright (c) 2026 Matt Pocock. Its pointer to the unshipped `/grilling` and `/domain-modeling` skills was replaced with an equivalent procedure |
| design-an-interface | https://github.com/mattpocock/skills | MIT | Retired upstream. Last seen at `skills/deprecated/design-an-interface/SKILL.md`, commit `3e3ca9b9fa007614c65fab70469127b25841881d` (2026-04-28), since deleted. Byte-identical but for the description |
| qa | https://github.com/mattpocock/skills | MIT | Retired upstream. Last seen at `skills/deprecated/qa/SKILL.md`, commit `62f43a18177be6ec82da242e59ffbc490a4c22ea` (2026-04-28), since deleted. Byte-identical but for the description |
| seo-geo | https://github.com/ReScienceLab/opc-skills | Apache-2.0 | Corrected in 5.1.1: the LICENSE file is Apache-2.0. The upstream README badge says MIT and a nested `plugin.json` says MIT, which is where the earlier MIT claim came from |
| seo-geo/references/seo-aeo-best-practices | https://github.com/sanity-io/agent-toolkit | MIT | Corrected in 5.1.1: this came from Sanity, not opc-skills. Copyright (c) 2025 Sanity. All five files byte-identical |
| git-ops/references/git-commit | https://github.com/github/awesome-copilot (`skills/git-commit/SKILL.md`) | MIT | Resolved in 5.1.2. Copyright GitHub, Inc. The as-vendored copy was byte-identical to upstream commit `e24be77e`; the current file rewrites step 4 to route through `.agents/scripts/commit.sh` and rewords the description (40 diff lines). Upstream has since rewritten the skill |
| performance-engineer | https://github.com/wshobson/agents (`plugins/application-performance/agents/performance-engineer.md`) | MIT | Resolved in 5.1.2. Copyright (c) 2024 Seth Hobson; 83% of the body is verbatim upstream commit `f662524f`. The `## Use this skill when` / `## Safety` / `## Limitations` wrapper and the frontmatter came from https://github.com/sickn33/agentic-awesome-skills (MIT code, CC BY 4.0 prose), which carries no upstream notice for this skill |
| anti-ai-ui/references/frontend-ui-engineering | https://github.com/addyosmani/agent-skills (`skills/frontend-ui-engineering/SKILL.md`) | MIT | Resolved in 5.1.2. Copyright (c) 2025 Addy Osmani. The body is byte-identical to upstream commit `cea2f381`; Dev-OS added only attribution frontmatter. Upstream has since revised the skill |

## Declared only (no upstream LICENSE file)

The upstream states a license in its README or package metadata but ships no LICENSE file, so there is no copyright line to reproduce and the grant rests on that statement.

| Skill (path) | Upstream | License | Notes |
|---|---|---|---|
| deploy-to-vercel | https://github.com/vercel-labs/agent-skills | MIT (README) | Dev-OS added a human-confirmation gate before any upload or deploy |
| deploy-to-vercel/references/vercel-cli-with-tokens | https://github.com/vercel-labs/agent-skills | MIT (README) | |
| vercel-composition-patterns | https://github.com/vercel-labs/agent-skills | MIT (README) | |
| vercel-optimize | https://github.com/vercel-labs/agent-skills | MIT (README) | |
| vercel-react-best-practices | https://github.com/vercel-labs/agent-skills | MIT (README) | |
| vercel-react-native-skills | https://github.com/vercel-labs/agent-skills | MIT (README) | |
| vercel-react-view-transitions | https://github.com/vercel-labs/agent-skills | MIT (README) | |
| writing-guidelines | https://github.com/vercel-labs/agent-skills | MIT (README) | |
| anti-ai-ui/references/web-design-guidelines | https://github.com/vercel-labs/agent-skills | MIT (README) | |
| supabase/references/nextjs-supabase-auth | https://github.com/vibeforge1111/vibeship-spawner-skills | Apache-2.0 (README + package.json) | A markdown rendering of upstream's `integrations/nextjs-supabase-auth/*.yaml` |

## Copyleft — not under the Dev-OS MIT license

| Skill (path) | Upstream | License | Notes |
|---|---|---|---|
| security-review | OWASP Cheat Sheet Series, https://cheatsheetseries.owasp.org/ | **CC BY-SA 4.0** | ShareAlike. The reference material is adapted from the OWASP cheat sheets and stays under CC BY-SA 4.0; it is **not** MIT. Terms in the skill's own `LICENSE`. The original skill author is unknown |

## Attribution required, origin unverified

| Skill (path) | Distributor | License | Notes |
|---|---|---|---|
| backend-dev-guidelines | https://github.com/sickn33/agentic-awesome-skills | MIT (code) + CC BY 4.0 (prose) | Repo was `sickn33/antigravity-awesome-skills`. Present in that repo's initial commit as `source: community` with no upstream link, and absent from its own attribution manifest. The text references a private codebase, so the original author is unknown and the distributor's grant may not be effective. Attribution and the changes note are in `.agents/licenses/CC-BY-4.0.txt` |

## Unresolved

None. Every vendored skill is attributed above or listed as first-party below.

## Removed

| Skill (path) | Reason |
|---|---|
| agent-development | Removed in 5.1.1. It was a near-verbatim copy of `anthropics/claude-code` `plugins/plugin-dev/skills/agent-development` (415-line SKILL.md differing only in frontmatter; the other 6 files byte-identical). That repository's `LICENSE.md` reserves all rights and grants no redistribution right, so it could not be shipped |

## First-party (Dev-OS, MIT)

Written for Dev-OS and covered by the Dev-OS license: anti-ai-ui, autonomous-sdlc, deployment-checklist, eval-harness, git-ops, git-ops/references/git-workflow, grill-me (inspired by Matt Pocock's grill-me), human-checkpoint, project-requirements, shared-memory, spec-driven, stacks, task-board, task-contract, telemetry, testing-guide, token-optimization, workflow-metrics.

Two files were reclassified as first-party in 5.1.2 after their origin was traced:

- `anti-ai-ui/references/design/GUIDE.md` — Dev-OS original. Its body is unchanged since this repository's second commit (`f281274`, 2026-06-19), which predates any external skill vendoring here (`7a2a2d0`, 2026-06-30), and verbatim phrase searches return only this repository and installs of it.
- `anti-ai-ui/references/frontend-ui-engineering/references/accessibility-checklist.md` — Dev-OS written, not vendored. Upstream `addyosmani/agent-skills` ships a different and longer WCAG 2.1 AA checklist; this is a shorter WCAG 2.2 AA one with no shared wording. Its individual bullets restate WCAG success criteria, which many projects write independently, so no third party holds it.

Sub-directories under a vendored skill's own `references/` that are not merged skills (for example `vercel-optimize/references/playbooks` and `.../support-topics`) are part of that skill and carry its license.
