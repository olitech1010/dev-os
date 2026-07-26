---
name: stacks
description: Stack-specific coding standards for web, server, mobile, and desktop. Copy the relevant stack file into your project root as CODING_STANDARDS.md (devos init does this).
---

# Stack-Specific Coding Standards

This directory contains coding standards for supported technology stacks.

**Stack vs runtime:** Stack identity is the framework (e.g. `hono`). Runtime (Bun, Node, Deno, PHP, Python, …) is inferred from the host project and stored in `.agents/project.json`.

## Deep stacks

- `hono.md` — Hono (server; runtime inferred)
- `nextjs.md` — Next.js + TypeScript
- `laravel.md` — Laravel + PHP
- `django.md` — Django + DRF
- `react-native.md` — React Native + Expo

## Thin stacks

- `react-vite.md` — React + Vite
- `vue-nuxt.md` — Vue / Nuxt
- `sveltekit.md` — Svelte / SvelteKit
- `express.md` — Express.js
- `fastify.md` — Fastify
- `nestjs.md` — NestJS
- `fastapi.md` — FastAPI
- `flutter.md` — Flutter
- `electron.md` — Electron
- `tauri.md` — Tauri

## Usage

`devos init` detects the host project, confirms the stack, and copies the matching file to `CODING_STANDARDS.md`. Agents should also read `.agents/project.json` for runtime, libraries, lint/test commands, and docs sources.
