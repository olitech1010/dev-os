# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-26
### Added
- Catalog-first stack registry (web, server, mobile, desktop) with deep and thin packs.
- Host detection at `devos init` (stack vs runtime; e.g. Hono + Bun runtime from lockfiles).
- `.agents/project.json` agent contract (commands, libraries, docsSources).
- `devos sync-docs` allowlisted docs cache under `.agents/knowledge/`.
- Deep `hono` standards; thin packs for React/Vite, Vue/Nuxt, SvelteKit, Fastify, NestJS, Flutter, Electron, Tauri.
- `devos test` command: runs `commands.test` from `.agents/project.json` (fallback `bun test`).
- Bun test suite for the `devos` package, invoked via `devos test`; `bun` as a devDependency.
- MIT `LICENSE`; npm `files`/`engines`/`prepublishOnly` hygiene.

### Changed
- CLI refactored into `lib/` modules (zero runtime dependencies).
- Researcher / QA / Tester prompts read project config for docs and lint/test commands.

## [1.0.0] - 2026-07-16
### Added
- Re-engineered Dev-OS to be a top-notch industry agentic development OS.
- Human-in-the-loop commit gate workflow.
- 49 global skills copied into project.
- Next.js 15, Laravel 12, FastAPI, and Express stack standards.
- Task Contracts, Human Checkpoint, and Workflow Metrics skills.
