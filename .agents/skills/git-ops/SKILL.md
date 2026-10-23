---
name: git-ops
description: "Use when branching, staging, preparing a commit message, committing, pushing, or opening a pull request. Enforces the human-in-the-loop commit gate (.agents/scripts/commit.sh, never raw git commit), Conventional Commits, and the branch and PR workflow."
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
5. **Commit & Human Gate**: Once QA approves, hand the commit to the human. Agents cannot commit at all: `commit.sh` and the git pre-commit and pre-merge-commit hooks refuse whenever an agent-shell marker is set (`CLAUDECODE`, `GEMINI_CLI`, `CODEX_*`, `CURSOR_AGENT`, `AI_AGENT`, and similar).
   - Stage your files: `git add <specific-files>`
   - Propose a Conventional Commit message and present the staged summary.
   - Ask the human to run `./.agents/scripts/commit.sh` from their own terminal. The script prompts for an `approve` token, the type, and the message on `/dev/tty`.
   - **DO NOT run `git commit` or `commit.sh` yourself.**
6. **Push**: only when the human explicitly asks: `git push origin HEAD`
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

## References

- `references/git-commit/GUIDE.md`: read when preparing a commit: detecting type and scope from the staged diff, writing the Conventional Commit message, and grouping files into logical commits before handing off to `.agents/scripts/commit.sh`. Formerly the `git-commit` skill.
- `references/git-workflow/GUIDE.md`: read when choosing a branch name, following the simplified GitHub flow, or writing a pull request. Formerly the `git-workflow` skill.
