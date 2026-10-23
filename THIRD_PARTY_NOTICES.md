# Third-Party Notices

Dev-OS bundles agent skills adapted from third-party open-source projects. This file lists each vendored skill, where it came from, and its license. The full license text of each upstream project is available at the linked repository. Dev-OS changes vendored skills: it edits descriptions, routes commits through `.agents/scripts/commit.sh`, adds human-confirmation steps, splits large files into `references/`, and merges overlapping skills.

Verification (October 2026): "Verified" means the upstream repository and its license were confirmed against the repository page, or against a license file bundled with the skill. "Source unverified" means the origin could not be confirmed. Those skills keep whatever provenance their own frontmatter states. If you are an upstream author and see an error, please open an issue at https://github.com/olitech1010/dev-os/issues.

Paths are relative to `.agents/skills/`. A path under `<skill>/references/<name>/` is a skill that was merged into `<skill>` in Dev-OS 5.0. The old name still resolves through the `aliases` map in `.agents/packs.json`.

## Verified

| Skill (path) | Upstream | License | Notes |
|---|---|---|---|
| agent-browser | https://github.com/vercel-labs/agent-browser | Apache-2.0 | |
| brainstorming | https://github.com/obra/superpowers | MIT | |
| writing-plans | https://github.com/obra/superpowers | MIT | Adapted for the Dev-OS plan gate |
| content-strategy | https://github.com/coreyhaines31/marketingskills | MIT | |
| image | https://github.com/coreyhaines31/marketingskills | MIT | |
| image/references/imagegen-frontend-web | https://github.com/Leonxlnx/imagegen-skills | MIT | Previously in Leonxlnx/taste-skill (MIT). Split into references/ |
| imagegen | https://github.com/openai/skills | Apache-2.0 | License from bundled `LICENSE.txt`. The upstream path (`skills/.system/imagegen`) was confirmed only through third-party catalogs |
| skill-creator | https://github.com/anthropics/skills | Apache-2.0 | License from bundled `LICENSE.txt` |
| anti-ai-ui/references/ui-designer | https://github.com/anthropics/skills (`frontend-design`) | Apache-2.0 | The suspicious `find-relevant-image.py` section was removed in wave 1 |
| deploy-to-vercel | https://github.com/vercel-labs/agent-skills | MIT | Dev-OS added a human-confirmation gate before any upload or deploy |
| deploy-to-vercel/references/vercel-cli-with-tokens | https://github.com/vercel-labs/agent-skills | MIT | |
| vercel-composition-patterns | https://github.com/vercel-labs/agent-skills | MIT | |
| vercel-optimize | https://github.com/vercel-labs/agent-skills | MIT | |
| vercel-react-best-practices | https://github.com/vercel-labs/agent-skills | MIT | |
| vercel-react-native-skills | https://github.com/vercel-labs/agent-skills | MIT | |
| vercel-react-view-transitions | https://github.com/vercel-labs/agent-skills | MIT | |
| writing-guidelines | https://github.com/vercel-labs/agent-skills | MIT | |
| anti-ai-ui/references/web-design-guidelines | https://github.com/vercel-labs/agent-skills | MIT | |
| find-skills | https://github.com/vercel-labs/skills | MIT | |
| expose-localhost | https://github.com/ngrok/agent-skills | MIT | |
| google-agents-cli-adk-code | https://github.com/google/agents-cli | Apache-2.0 | 5 sibling skills are not shipped |
| google-agents-cli-workflow | https://github.com/google/agents-cli | Apache-2.0 | 5 sibling skills are not shipped |
| humanizer | https://github.com/blader/humanizer | MIT | Rewritten for Dev-OS (v3) |
| laravel-security | https://github.com/affaan-m/everything-claude-code | MIT | Split into references/ |
| laravel-tdd | https://github.com/affaan-m/everything-claude-code | MIT | Split into references/ |
| laravel-verification | https://github.com/affaan-m/everything-claude-code | MIT | |
| laravel-specialist | https://github.com/Jeffallan/claude-skills | MIT | Author from the skill's frontmatter |
| nextjs-developer | https://github.com/Jeffallan/claude-skills | MIT | Author from the skill's frontmatter |
| nextjs-developer/references/nextjs-app-router-patterns | https://github.com/wshobson/agents | MIT | |
| backend-dev-guidelines/references/nodejs-backend-patterns | https://github.com/wshobson/agents | MIT | |
| modern-web-guidance | https://github.com/GoogleChrome/modern-web-guidance | Apache-2.0 | The self-declared mandate and the unpinned `npx -y ...@latest` were removed in wave 1 |
| shadcn-ui | https://github.com/google-labs-code/stitch-skills (`plugins/stitch-build/skills/shadcn-ui`) | Apache-2.0 | License at repository level |
| supabase | https://github.com/supabase/agent-skills | MIT | |
| supabase-postgres-best-practices | https://github.com/supabase/agent-skills | MIT | |
| ui-ux-pro-max | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | MIT | Optional `design-data` pack |
| grill-me/references/grill-with-docs | https://github.com/mattpocock/skills | MIT | Its pointer to the unshipped `/grilling` and `/domain-modeling` skills was replaced with an equivalent procedure |
| seo-geo | https://github.com/ReScienceLab/opc-skills | MIT | The license was confirmed through secondary sources (DeepWiki, skill catalogs), not by reading the LICENSE file |

## Source unverified

These skills appear to be vendored, but their upstream repository or license could not be confirmed. They are kept with the provenance stated in their own files.

| Skill (path) | Likely origin (unconfirmed) | License |
|---|---|---|
| design-an-interface | mattpocock/skills (catalogs list it; the current upstream index does not) | source unverified |
| qa | mattpocock/skills (not in the current upstream index) | source unverified |
| backend-dev-guidelines | sickn33/antigravity-awesome-skills (listed in that collection; frontmatter says "source: community") | source unverified |
| performance-engineer | community collection (frontmatter says "source: community") | source unverified |
| backend-dev-guidelines/references/backend-development | unknown | source unverified |
| backend-dev-guidelines/references/backend-patterns | possibly affaan-m/everything-claude-code | source unverified |
| supabase/references/nextjs-supabase-auth | frontmatter says "vibeship-spawner-skills (Apache 2.0)" | source unverified |
| security-review | unknown skill author; the reference material is derived from the OWASP Cheat Sheet Series (https://cheatsheetseries.owasp.org/), see the bundled `LICENSE` | source unverified |
| code-reviewer | possibly google-gemini/gemini-cli | source unverified |
| agent-development | anthropics/claude-code (`plugin-dev` plugin) | source unverified |
| anti-ai-ui/references/frontend-ui-engineering | unknown | source unverified |
| anti-ai-ui/references/design | unknown | source unverified |
| image/references/image-generation | unknown | source unverified |
| seo-geo/references/seo-aeo-best-practices | unknown | source unverified |
| git-ops/references/git-commit | unknown (heavily adapted for the Dev-OS commit gate) | source unverified |

## First-party (Dev-OS, MIT)

Written for Dev-OS and covered by the Dev-OS license: anti-ai-ui, autonomous-sdlc, deployment-checklist, eval-harness, git-ops, git-ops/references/git-workflow, grill-me (inspired by Matt Pocock's grill-me), human-checkpoint, project-requirements, shared-memory, stacks, task-board, task-contract, telemetry, testing-guide, token-optimization, workflow-metrics.
