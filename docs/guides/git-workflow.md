# Git Workflow Guide

## Branch Strategy: GitHub Flow (simplified)

We use a simplified GitHub Flow. One long-lived branch (`main`), everything else is short-lived feature branches.

```
main (always deployable)
  └── feat/user-authentication
  └── fix/password-reset-email
  └── chore/upgrade-dependencies
```

**Rules:**
- `main` is always in a deployable state. Never push broken code to main.
- Feature branches are created from `main` and merged back via PR.
- Feature branches should live for **days, not weeks**. Long-lived branches = merge conflicts = pain.
- Delete branches after merging.

---

## Daily Workflow

```bash
# 1. Start a new task
git checkout main
git pull origin main
git checkout -b feat/your-feature-name

# 2. Work in small commits (commit often)
git add -p                           # Stage interactively — review what you're committing
git commit -m "feat(auth): add email verification step"

# 3. Keep your branch current
git fetch origin
git rebase origin/main               # Prefer rebase over merge for feature branches

# 4. Push and open PR
git push origin feat/your-feature-name
# Open PR on GitHub using the PR template
```

---

## Commit Discipline

Commit after every **logical unit of work** — not every file save, not every hour.

A logical unit = "I could describe what changed in one sentence."

```bash
# ✅ Good — one thing changed
git commit -m "feat(forms): add zod validation to login form"

# ❌ Too broad — multiple unrelated things
git commit -m "misc updates and fixes"

# ❌ Too granular — not a meaningful unit
git commit -m "added semicolon"
```

### Interactive Staging (`git add -p`)
Before committing, review exactly what you're staging. This prevents accidental commits of debug code, env files, or half-finished work.

```bash
git add -p
# y = stage this hunk
# n = skip
# s = split into smaller hunks
# e = edit manually
```

---

## Pull Request Standards

### PR Size
- **Small PRs get reviewed fast. Large PRs get ignored.**
- Target: under 400 lines changed per PR
- If a feature is large, split it into a stack of PRs: data layer first, then API, then UI

### PR Description Must Include
1. **What changed** — what does this PR do?
2. **Why** — what problem does it solve?
3. **How to test** — exact steps to verify the change works
4. **Screenshots** (if UI changed)
5. **Breaking changes** (if any)

### Before Opening a PR
```bash
# Run the full check suite locally first
npm run lint
npm run typecheck
npm run test
npm run build

# Make sure your branch is current
git fetch origin
git rebase origin/main
```

### Merging
- Squash merge for feature branches (clean history on main)
- Regular merge for release or hotfix branches
- Never force-push to `main`

---

## Hotfix Workflow

For urgent production fixes:

```bash
git checkout main
git pull origin main
git checkout -b fix/critical-auth-bypass

# make the fix
git commit -m "fix(auth): prevent session token reuse after logout"

# Open PR, get fast review, merge
# Then immediately deploy
```

---

## Tags and Releases

```bash
# Tag releases on main
git tag -a v1.2.0 -m "Release v1.2.0 — adds multi-language support"
git push origin v1.2.0
```

Use semantic versioning: `MAJOR.MINOR.PATCH`
- `MAJOR` — breaking change
- `MINOR` — new feature, backwards compatible
- `PATCH` — bug fix

---

## What to Never Commit

Add these to `.gitignore` — and verify they're there before the first commit of any project:

```
.env
.env.local
.env.*.local
*.pem
*.key
node_modules/
__pycache__/
.DS_Store
dist/
build/
*.log
```

If a secret was ever committed (even in a past commit), treat it as compromised and rotate it immediately. History rewrites do not make secrets safe.
