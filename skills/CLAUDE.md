# CLAUDE.md — Global Engineering Context

> This is the universal base. Copy this file to your project root, then add your stack-specific `CLAUDE.md` content below it from `stacks/<your-stack>/CLAUDE.md`.

---

## Project Identity

- **Project name:** [PROJECT_NAME]
- **Description:** [One sentence: what this system does and for whom]
- **Stack:** [e.g. Next.js 14 / Supabase / Tailwind / TypeScript]
- **Environment:** [e.g. Vercel (prod) / Railway (staging) / Local (dev)]

---

## How to Run This Project

```bash
# Install dependencies
[command]

# Start development server
[command]

# Run tests
[command]

# Run linter
[command]

# Build for production
[command]
```

---

## Agent System

This project uses the Olives Technologies multi-agent workflow. See `agents/AGENTS.md` for the full agent roster and protocols.

When acting as an agent in this project, read your role definition from `agents/prompts/<your-role>.md` before beginning any task.

### Available Skills
- `skills/grill-me.md` — Project inception interrogation (used by Architect agent)
- `skills/design.md` — Design system principles (used by Developer on UI work)
- `skills/token-optimization.md` — **All agents must follow this.** Minimize token usage at all times.

---

## Universal Rules (All Agents, All Stacks)

### Never Do These
- Hardcode secrets, API keys, or environment-specific values in code
- Delete files without explicit human instruction
- Execute database migrations without a written plan and human approval
- Deploy to production without human approval
- Swallow exceptions silently (`catch (e) {}`)
- Leave `console.log`, `print()`, or `dd()` in code headed to production
- Use `// TODO` without a linked issue reference
- Bypass type checking without a documented reason

### Always Do These
- Read existing code in the area you're touching before writing new code
- Confirm package versions with the Researcher before installing
- Validate all user input at the system boundary
- Handle errors explicitly with meaningful messages
- Write code as if the next person to read it knows nothing about your intent

---

## Commit Standards

This project uses **Conventional Commits**.

```
type(scope): short description

[optional body — explain why, not what]

[optional footer — BREAKING CHANGE: or Closes #123]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `security`

**Examples:**
```
feat(auth): add JWT refresh token rotation
fix(api): prevent 500 on missing user ID param
docs(readme): update local setup instructions
security(uploads): validate file type before storage
chore(deps): upgrade supabase-js to 2.39.0
```

**Rules:**
- Present tense, imperative mood: "add" not "added", "fix" not "fixed"
- No capital letter at start of description
- No period at end
- Body explains *why*, not *what*
- Breaking changes must include `BREAKING CHANGE:` in footer

---

## Branch Naming

```
feat/short-description
fix/short-description
docs/short-description
chore/short-description
security/short-description
```

---

## PR Standards

- One feature or fix per PR — no bundling unrelated changes
- PR description must explain: what changed, why, how to test
- All CI checks must pass before merge
- At least one human review before merging to `main`
- Use the PR template at `templates/pull_request/PULL_REQUEST_TEMPLATE.md`

---

## File Naming Conventions (Universal)

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Utilities / helpers | camelCase | `formatDate.ts` |
| Constants | SCREAMING_SNAKE | `MAX_UPLOAD_SIZE` |
| Config files | kebab-case | `tailwind.config.ts` |
| Test files | same as source + `.test` | `UserProfile.test.tsx` |
| Documentation | UPPER_SNAKE or Title | `CODING_STANDARDS.md` |

---

## Architecture Decision Records

Major decisions live in `docs/decisions/`. Before making a significant architectural choice (changing auth strategy, adding a major dependency, restructuring the database), write an ADR using the template in `docs/DECISIONS.md`.

---

## Environment Variables

- All required variables are documented in `.env.example` with descriptions
- Never commit real values — only placeholder labels
- If a variable is missing from the environment, the application should fail loudly at startup, not silently at runtime

---

## Stack-Specific Context

[Paste content from stacks/<your-stack>/CLAUDE.md below this line]
