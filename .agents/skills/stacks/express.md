---
name: express-stack
description: Thin stack standard for Express.js
---
# Express.js Stack Standard

## Tech Stack
- Framework: Express.js
- Language: TypeScript preferred
- Runtime: See `.agents/project.json` → `runtime` (usually node or bun)

## Standards
- **Architecture:** Prefer Controller-Service-Repository (or equivalent clear layers).
- **Error Handling:** Centralized async error-handling middleware.
- **Validation:** Zod or Joi for request validation.
- **Security:** Helmet, CORS, and rate limiting where applicable.
- Confirm APIs via `.agents/knowledge/express/` or `devos sync-docs`.

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json`.
