---
name: modern-web-guidance
description: "Use when implementing or reviewing HTML, CSS, or client-side JavaScript features (dialogs, popovers, anchor positioning, container queries, View Transitions, scroll-driven animation, Core Web Vitals, forms and autofill, modern web APIs) to check current web-platform best practices before writing code. Not for backend, SQL, CI/CD, Docker, or Git tasks."
metadata:
  source: https://github.com/GoogleChrome/modern-web-guidance
license: Apache-2.0
---

# Modern Web Guidance

A skill to look up specific web development use cases and retrieve their corresponding best practice guides. Web APIs evolve quickly, so check a guide before relying on remembered patterns.

## When to use

Use this skill:
- When starting a web feature where a modern platform pattern may exist.
- Before creating a new component, to check if a standardized pattern already exists.
- To avoid implementing ad-hoc solutions or loading large dependencies unnecessarily.

## Usage Instructions

### Step 0. Prefer the bundled guides (no network, no install)

This skill ships a local copy of the guides in `.agents/skills/modern-web-guidance/guides/<category>/<guide>.md`. Search them first:

```sh
grep -ril "<keyword>" .agents/skills/modern-web-guidance/guides/
```

Only fall back to the `npx` CLI below when the bundled guides do not cover the use case.

### Step 1. Search Use Cases (requires human approval)

The CLI is fetched from the npm registry and executed, which is a supply-chain and network side effect. Before running it:

1. **Ask the human first.** State the exact command and wait for approval. Never run it silently or as an automatic first step.
2. **Pin a version.** Use an exact version the human has approved (for example `modern-web-guidance@<x.y.z>`). Do not use `@latest`.
3. **Do not pass `-y`.** Let `npx` show its install prompt so the human sees what is being downloaded.

Search with an action-oriented query summarizing what you want to achieve using the `search` command:

```sh
npx modern-web-guidance@<pinned-version> search "<query>" --skill-version 2026_05_16-c5e78707
```

**Example Output**:
```json
[
  {
    "id": "optimize-image-priority",
    "description": "Optimize the loading priority of Largest Contentful Paint (LCP) candidate images.",
    "category": "performance",
    "featuresUsed": [ "Fetch priority" ],
    "tokenCount": 985,
    "similarity": 0.7289
  },
  {
    "id": "defer-rendering-heavy-content",
    "description": "Reduce rendering times in content-heavy web pages by deferring rendering for offscreen content.",
    "category": "performance",
    "featuresUsed": [ "content-visibility", "hidden=\"until-found\"" ],
    "tokenCount": 1250,
    "similarity": 0.6961
  }
]
```

> **Note**: If search results are vague, return no matches, or show low similarity scores, run the `list` command to browse all guides:
> ```sh
> npx modern-web-guidance@<pinned-version> list
> ```

---

### Step 2. Retrieve Best Practices

Once you have a relevant `id` from the search results, call this script using the `retrieve` command to get the full guide. You can pass multiple IDs separated by commas.

```sh
npx modern-web-guidance@<pinned-version> retrieve "<id>"
```


**Example Output**:
`The markdown content of the guide describing implementation steps...`

## Using npx

-   IMPORTANT: on Windows, using `npx` may fail. Use `npx.cmd ...` instead.
-   Network access is required for fetching npm packages needed by the task.
-   The same approval rule applies to every `npx` call in this skill: ask the human, pin the version, no `-y`.
-   If the `npx modern-web-guidance…` command hangs, you may be offline. Try running again in offline
    mode: `npx --offline …`.
-   The `--skill-version` flag is used to determine if this SKILL.md is out of date. If it is, a warning
    message is logged to stderr.

## Guidelines

-   Check the bundled guides first, then (with approval) the CLI, to find the most relevant guides.
-   These guides are usually framework-agnostic; adapt them correctly to your setup.
-   Do not hallucinate guides or ignore them; they represent the preferred local standard for the user's project.


## Interpreting Browser Support & Fallbacks

* **Default Behavior**: All guides assume **Baseline Widely available** features are safe to use without fallbacks. For features that are not Baseline widely available, you **MUST** follow the fallback recommendations in the guide, unless the user has specified a custom browser support policy.
* **Custom Policies**: If the user has already defined explicit browser support requirements, use the browser compatibility data in the guide to determine if a fallback can be safely ignored.
  - For Baseline YYYY targets, a feature satisfies this target if its "Baseline since" date is <= YYYY.
  - **Policy Examples**:
    - _"Do not implement feature fallbacks."_ (for exploratory prototypes of the cutting-edge web)
    - _"Safari 17.4+"_ (for internal tools targeting macOS or Tauri-based desktop apps)
    - _"Never recommend or implement polyfills; if a Baseline Newly Available feature is required for core functionality, provide a lightweight custom fallback or redesign the approach."_ (to minimize bundle size and avoid technical debt)
    - _"Assume a modern execution environment where Baseline Newly Available features can be used natively, provided they are strictly feature-detected and degrade gracefully."_ (for progressive enhancement strategies)
* **Reactive Policy Discovery**: Watch for environmental cues to suggest documenting a policy in CLAUDE.md or AGENTS.md. Suggest this if the developer:
  - Mentions building for a restricted runtime (e.g., Electron or Tauri).
  - Explicitly excludes specific targets (e.g., "we don't support Desktop Chrome").
  - Expresses hesitation about polyfill complexity, bundle size, or performance cost.
  - Questions if a feature is safe to use without fallbacks.

  No defined policy format. This is an example: `**Browser Support:** Allow Newly Available features, but only adopt custom fallback code that adds <= 20 lines and does not require external dependencies.`
