# Contributing to Olives Technologies Starter

Thank you for helping make this better. Every contribution — fixing a typo, improving an agent prompt, or adding an entirely new stack — makes the system more valuable for every developer who uses it.

---

## What We're Looking For

### High-Priority Contributions
- **New stack support** — React Native, Flutter, Vue, Go, Ruby on Rails, etc.
- **Agent prompt improvements** — better reasoning, tighter constraints, clearer outputs
- **Real-world deployment guides** — battle-tested steps for specific platforms (Railway, Render, Fly.io, AWS, GCP)
- **Security checklist additions** — OWASP-aligned, stack-specific checks
- **CI/CD workflow templates** — GitHub Actions, GitLab CI

### Also Welcome
- Typo and clarity fixes in any document
- Additional ADR examples
- Tool-specific skill configs (Windsurf, Aider, etc.)
- Translations of core docs

---

## Contribution Process

### 1. Find or create an issue first
Before writing anything, open an issue or find an existing one. This prevents duplicate work and lets us align on approach before you invest time.

Use the issue templates:
- 🐛 **Bug / Error** — something in the docs is wrong or misleading
- ✨ **Improvement** — making an existing file better
- 🏗️ **New Stack** — adding a stack that doesn't exist yet
- 🤖 **Agent Prompt** — changes to agent system prompts

### 2. Fork and branch
```bash
git fork https://github.com/olivestechnologies/starter
git checkout -b feat/add-django-stack
# or
git checkout -b fix/reviewer-agent-prompt
```

Branch naming: `type/short-description`
Types: `feat`, `fix`, `docs`, `chore`

### 3. Make your changes
Follow the standards in this repo. If you're adding a new stack:
- Copy `stacks/nextjs/` as your starting template
- Fill in all three files: `CLAUDE.md`, `CODING_STANDARDS.md`, `DEPLOYMENT.md`
- Add your stack to the tree in the root `README.md`

### 4. Commit with conventional commits
```
feat(stacks): add django stack with DRF support
fix(agents): clarify reviewer agent output format
docs(nextjs): update deployment steps for Next.js 15
```

Format: `type(scope): description`

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
Valid scopes: `agents`, `stacks`, `skills`, `docs`, `templates`, `nextjs`, `laravel`, `django`, etc.

### 5. Open a Pull Request
Use the PR template. Fill it out fully — context helps reviewers move fast.

---

## Standards for Contributions

### Agent Prompts
- Must be in second person ("You are a..."), present tense
- Must include: Role, Responsibilities, Constraints (hard limits), Output Format
- Must not exceed 800 words — agents need focused context, not essays
- Test your prompt with Claude Code or Cursor before submitting

### Stack Documents
- `CLAUDE.md` must be usable as-is by Claude Code — paste-ready, no placeholders that aren't obvious
- `CODING_STANDARDS.md` must include: file structure, naming conventions, forbidden patterns, required patterns
- `DEPLOYMENT.md` must cover at least one free/low-cost deployment target for solo developers

### General
- Write in plain English. This is read by both humans and AI — clarity serves both.
- No marketing language. Every sentence should be actionable or informational.
- If you're opinionated, say so. "We prefer X over Y because..." is better than pretending there's only one way.

---

## Questions?

Open a Discussion on GitHub. PRs with questions in them tend to stall — Discussions keep things moving.
