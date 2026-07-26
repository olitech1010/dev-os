---
name: vue-nuxt-stack
description: Thin stack standard for Vue / Nuxt
---
# Vue / Nuxt Stack Standard

## Tech Stack
- Framework: Nuxt (preferred) or Vue SPA
- Language: TypeScript preferred
- Runtime: See `.agents/project.json` → `runtime`

## Standards
- Prefer Composition API and `<script setup>` for Vue SFCs.
- Follow Nuxt conventions for `pages/`, `server/`, and auto-imports when using Nuxt.
- Confirm APIs against official docs (`devos sync-docs` / `.agents/knowledge/`).

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json`.
