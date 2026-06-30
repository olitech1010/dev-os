---
name: git-ops
description: Autonomous Git behavior rules for Developer and DevOps agents. Instructs agents to commit frequently, push to remote, and manage pull requests.
---

# Git Operations (GitOps) Skill

> This skill governs how agents interact with version control autonomously.

## The "Commit Often" Principle

Agents do not need to be told to commit their work. You must **automatically commit your work** after completing any logical unit of progress.

A "logical unit of work" is:
- A completed file or component
- A passing test suite
- A fixed bug
- A completed sub-task in the execution plan

**Do not wait until the end of the entire feature to commit.** Multiple small commits are infinitely better than one massive "did the work" commit.

## Autonomous Workflow

When you are assigned a task:

1. **Check Status**: `git status` to ensure a clean working tree.
2. **Branch Management**: 
   - If you are on `main`, ask the Orchestrator or User what feature branch to create.
   - If instructed to start a feature: `git checkout -b feat/your-feature-name`
3. **Execute & Commit**:
   - Write code.
   - Run tests/linting.
   - `git add <specific-files>` (never blindly `git add .` without checking status).
   - `git commit -m "feat(scope): descriptive message"`
4. **Repeat step 3** for each logical unit of work until the assignment is done.
5. **Push**: `git push origin HEAD`
6. **PR (If Complete)**: If the entire feature is done, inform the Orchestrator/User that the branch is pushed and ready for a Pull Request, or use a GitHub CLI command to open the PR if the tool is available.

## Commit Message Standard (Conventional Commits)

You must use the Conventional Commits format:
`<type>(<scope>): <short description>`

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries

Example: `feat(auth): implement JWT token rotation`

## Strict Constraints

1. **Never commit secrets**. Always check diffs before committing. If an API key or password is in the code, remove it, use an environment variable, and then commit.
2. **Never force-push (`-f`)**. If your push is rejected, pull with rebase (`git pull --rebase origin main`), resolve conflicts, and try pushing again.
3. **Never commit broken code** to `main`. If you are on `main`, stop and switch to a branch.
