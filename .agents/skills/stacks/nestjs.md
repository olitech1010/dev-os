---
name: nestjs-stack
description: Thin stack standard for NestJS
---
# NestJS Stack Standard

## Tech Stack
- Framework: NestJS
- Language: TypeScript
- Runtime: See `.agents/project.json` → `runtime`

## Standards
- Prefer module / controller / service separation.
- Use dependency injection; avoid service locators.
- Validate DTOs with class-validator or Zod pipes as project convention dictates.
- Confirm APIs via `.agents/knowledge/nestjs/` or `devos sync-docs`.

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json`.
