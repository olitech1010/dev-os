---
name: electron-stack
description: Thin stack standard for Electron
---
# Electron Stack Standard

## Tech Stack
- Framework: Electron
- Language: TypeScript preferred
- Runtime: See `.agents/project.json` → `runtime` (usually node)

## Standards
- Keep main and renderer process boundaries clear; use contextBridge for privileged APIs.
- Never enable `nodeIntegration` in untrusted renderer content.
- Confirm APIs via `.agents/knowledge/electron/` or `devos sync-docs`.

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json`.
