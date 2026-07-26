---
name: react-vite-stack
description: Thin stack standard for React + Vite
---
# React + Vite Stack Standard

## Tech Stack
- UI: React
- Bundler: Vite
- Language: TypeScript preferred
- Runtime: See `.agents/project.json` → `runtime`

## Standards
- Prefer function components and hooks; avoid class components.
- Colocate components with their styles/tests when practical.
- Do not invent Vite/React APIs — use `.agents/knowledge/` or official docs via Researcher / `devos sync-docs`.

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json`.
