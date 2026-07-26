---
name: sveltekit-stack
description: Thin stack standard for Svelte / SvelteKit
---
# Svelte / SvelteKit Stack Standard

## Tech Stack
- Framework: SvelteKit (or Svelte)
- Language: TypeScript preferred
- Runtime: See `.agents/project.json` → `runtime`

## Standards
- Prefer SvelteKit load functions and form actions over ad-hoc client fetching when on the server.
- Keep stores/state minimal; prefer local component state first.
- Verify APIs via `.agents/knowledge/` or `devos sync-docs`.

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json`.
