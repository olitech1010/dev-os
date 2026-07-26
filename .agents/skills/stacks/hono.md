---
name: hono-stack
description: Stack standard for Hono server framework (runtime-agnostic)
---
# Hono Stack Standard

## Tech Stack
- Framework: Hono
- Language: TypeScript (preferred) or JavaScript
- Runtime: Inferred from the host project (Bun, Node, Deno, Cloudflare Workers, etc.) — check `.agents/project.json` → `runtime`
- Validation: Zod (or Valibot) when request schemas are needed
- Testing: Use the host project's test command from `.agents/project.json` → `commands.test`

## Standards
- **Routing:** Prefer Hono routers and `app.route()` composition over mega-handlers.
- **Middleware:** Use Hono middleware for auth, CORS, logging, and error handling. Keep middleware small and composable.
- **Handlers:** Keep handlers thin; push business logic into services/modules.
- **Types:** Prefer typed `Context` variables and Zod-validated inputs over `any`.
- **Errors:** Use consistent HTTPException (or equivalent) mapping; never leak stack traces in production responses.
- **Env:** Read secrets from environment / runtime bindings — never hardcode credentials.
- **Docs accuracy:** Before using non-obvious Hono APIs, consult `.agents/knowledge/hono/` or run `devos sync-docs`. Do not invent APIs.

## QA Commands
Agents must run lint/test commands from `.agents/project.json` (not hardcoded `npm test`).
