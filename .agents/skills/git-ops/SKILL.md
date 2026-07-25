---
name: git-ops
description: Git workflow rules enforcing the strict human-in-the-loop commit gate. Defines feature branching, review steps, and required human approvals before committing or pushing.
---

# Git Operations (GitOps) Skill

> This skill governs how agents interact with version control under strict human-in-the-loop constraints.

## The Human-in-the-Loop Rule

**No code is committed without explicit human approval.** The flow is ALWAYS:
1. Write Code -> 2. QA Approves -> 3. Human Approves (via commit script) -> 4. Commit -> 5. Push

## Feature Workflow

When assigned a task:

1. **Check Status**: `git status` to ensure a clean working tree.
2. **Branch Management**: 
   - If on `main`, ask the Orchestrator or User what feature branch to create.
   - If instructed to start a feature: `git checkout -b feat/your-feature-name`
3. **Execute**: Write the code and run tests/linting.
4. **QA Gate**: Pass output to the QA Agent. You MUST NOT commit yet.
5. **Commit & Human Gate**: Once QA approves, you MUST use the `.agents/scripts/commit.sh` script to mechanically enforce the human checkpoint.
   - Stage your files: `git add <specific-files>`
   - Execute the script: `./.agents/scripts/commit.sh`
   - The script will pause and prompt the human for approval. Once the human approves via the prompt, the script will handle the commit formatting and execution.
   - **DO NOT run `git commit` directly.**
6. **Push**: `git push origin HEAD`
7. **Repeat** for the next logical unit.

## Commit Message Standard (Conventional Commits)

Use the Conventional Commits format for all commits. The `commit.sh` script will enforce this format:
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

## Strict Constraints

1. **Never commit without human approval.** You must use `.agents/scripts/commit.sh`. Raw `git commit` is strictly forbidden.
2. **Never commit secrets**. If an API key or password is in the code, remove it, use an environment variable, and then run the commit script.
3. **Never force-push (`-f`)**. If your push is rejected, pull with rebase (`git pull --rebase origin main`), resolve conflicts, and try pushing again.
4. **Never commit broken code** to `main`. If you are on `main`, stop and switch to a branch.
