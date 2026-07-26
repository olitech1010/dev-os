---
name: fastapi-stack
description: Thin stack standard for FastAPI
---
# FastAPI Stack Standard

## Tech Stack
- Framework: FastAPI
- Language: Python 3.11+
- ORM: SQLAlchemy 2.0 (when used)
- Validation: Pydantic V2
- Runtime: python (see `.agents/project.json`)

## Standards
- **Structure:** Modular routers / services / models / schemas.
- **Typing:** Strict type hints required.
- **Async:** Prefer `async def` with async DB drivers when I/O-bound.
- **Dependencies:** Use FastAPI DI for sessions and auth.
- Confirm APIs via `.agents/knowledge/fastapi/` or `devos sync-docs`.

## QA Commands
Use `commands.lint` and `commands.test` from `.agents/project.json` (typically `ruff check .` / `pytest`).
