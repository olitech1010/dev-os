---
name: express-stack
description: Stack standard for Express.js, TypeScript, Node
---
# Express.js Stack Standard

## Tech Stack
- Framework: Express.js
- Language: TypeScript
- Node: LTS (20+)

## Standards
- **Architecture:** Use Controller-Service-Repository pattern.
- **Error Handling:** Centralized async error handling middleware.
- **Validation:** Use Zod or Joi for request validation middleware.
- **Security:** Helmet, CORS, Rate Limiting must be configured.
