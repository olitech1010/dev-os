# Getting Started with Dev-OS

This guide explains how to initialize Dev-OS in a new or existing repository and start collaborating with your multi-agent engineering team.

---

## 1. Installation Options

### Option A: Global NPM / NPX (Recommended)
Run the automated installer in your target project root:
```bash
npx devos init
```
*(Or install globally: `npm install -g devos` and run `devos init`)*

Non-interactive (CI / scripts):
```bash
npx devos init --yes
```

### Option B: Direct GitHub Installation
```bash
npx github:olitech1010/dev-os init
```

### Option C: Local Cloning & Linking (Fallback / Offline)
```bash
git clone https://github.com/olitech1010/dev-os.git
cd dev-os
npm link
cd /path/to/your-target-project
devos init
```

---

## 2. Interactive Setup

`devos init` **detects** your host project first (dependencies, lockfiles, language markers), then asks you to confirm:

1. **Fresh vs Existing** — fresh installs docs/standards; existing preserves customized `CODING_STANDARDS.md` and `docs/`.
2. **Stack** — framework identity from the catalog (e.g. Hono, Next.js, Laravel). Runtime (Bun, Node, Deno, PHP, …) is inferred separately and stored in `.agents/project.json`.
3. **Libraries** — edit the detected list (comma-separated).
4. **Opt-in host patches** — optionally merge missing `package.json` scripts (never overwrites existing keys).

Empty repos fall back to the catalog / Universal template.

### Docs knowledge cache

```bash
npx devos sync-docs
```

Fetches allowlisted official docs into `.agents/knowledge/` for the Researcher agent.

---

## 3. Development Workflow & Task Triage

When you assign a task to the **Orchestrator Agent**, it automatically triages your request:

1. **TRIVIAL** — Orchestrator may execute directly.
2. **STANDARD** — Developer → QA → Human. QA runs lint/test from `.agents/project.json` → `commands`.
3. **CRITICAL** — DBA / Security / DevOps with dry-run + human sign-off.

---

## 4. Approving Commits

Agents must use `./.agents/scripts/commit.sh` (type `approve` when prompted).

---

## 5. Related Documentation

- [System Architecture](./ARCHITECTURE.md)
- [Tutorial & Glossary](./TUTORIAL.md)
