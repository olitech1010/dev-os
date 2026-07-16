---
name: git-ops
description: Git workflow rules enforcing the strict human-in-the-loop commit gate. Defines feature branching, review steps, and required human approvals before committing or pushing.
---

# Git Operations (GitOps) Skill

> This skill governs how agents interact with version control under strict human-in-the-loop constraints.

## The Human-in-the-Loop Rule

**No code is committed without explicit human approval.** The flow is ALWAYS:
1. Write Code -> 2. Reviewer Approves -> 3. Human Approves -> 4. Commit -> 5. Push

## Feature Workflow

When assigned a task:

1. **Check Status**: `git status` to ensure a clean working tree.
2. **Branch Management**: 
   - If on `main`, ask the Orchestrator or User what feature branch to create.
   - If instructed to start a feature: `git checkout -b feat/your-feature-name`
3. **Execute**: Write the code and run tests/linting.
4. **Reviewer Gate**: Pass output to the Reviewer Agent. You MUST NOT commit yet.
5. **Human Gate**: Once Reviewer approves, present the changes to the human (User). Say: *"The code has passed review. Do I have your approval to commit these changes?"*
6. **Commit**: ONLY after human says yes:
   - `git add <specific-files>`
   - `git commit -m "feat(scope): descriptive message"`
7. **Push**: `git push origin HEAD`
8. **Repeat** for the next logical unit.

## Commit Message Standard (Conventional Commits)

Use the Conventional Commits format for all commits:
`<type>(<scope>): <short description>`

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries

Example: `feat(auth): implement JWT token rotation`

## Strict Constraints

1. **Never commit without human approval.** This is an absolute constraint.
2. **Never commit secrets**. If an API key or password is in the code, remove it, use an environment variable, and then ask for commit approval.
3. **Never force-push (`-f`)**. If your push is rejected, pull with rebase (`git pull --rebase origin main`), resolve conflicts, and try pushing again.
4. **Never commit broken code** to `main`. If you are on `main`, stop and switch to a branch.
