---
name: tauri-stack
description: Thin stack standard for Tauri
---
# Tauri Stack Standard

## Tech Stack
- Framework: Tauri
- Frontend: Web (React/Vue/Svelte/etc. as detected)
- Runtime: See `.agents/project.json` (often node + rust)

## Standards
- Prefer Tauri commands over ad-hoc shell execution.
- Keep capability/permission allowlists tight.
- Confirm APIs via `.agents/knowledge/tauri/` or `devos sync-docs`.

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json`.
