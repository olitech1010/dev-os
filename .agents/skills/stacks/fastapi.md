---
name: fastapi-stack
description: Stack standard for FastAPI, Python, SQLAlchemy
---
# FastAPI Stack Standard

## Tech Stack
- Framework: FastAPI
- Language: Python 3.11+
- ORM: SQLAlchemy 2.0
- Validation: Pydantic V2

## Standards
- **Structure:** Use a modular router setup (e.g., `routers/`, `services/`, `models/`, `schemas/`).
- **Typing:** Strict Python type hints required everywhere.
- **Async:** Use `async def` for endpoints and async database drivers (e.g., `asyncpg`).
- **Dependencies:** Use FastAPI's Dependency Injection for database sessions and auth.
