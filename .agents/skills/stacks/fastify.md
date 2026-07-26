---
name: fastify-stack
description: Thin stack standard for Fastify
---
# Fastify Stack Standard

## Tech Stack
- Framework: Fastify
- Language: TypeScript preferred
- Runtime: See `.agents/project.json` → `runtime`

## Standards
- Prefer Fastify plugins for encapsulation.
- Use schema validation (JSON Schema / TypeBox / Zod adapters) for inputs.
- Confirm APIs via `.agents/knowledge/fastify/` or `devos sync-docs`.

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json`.
