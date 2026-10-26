# Plan: Agent commits with per-commit human approval (v5.1.0)

Status: APPROVED by the human on 2026-10-25 ("proceed with your recommendation").

## Problem

5.0.0 refuses every commit from an agent shell. That closed the 4.x self-approval hole
(an agent typing `approve` itself, or setting `DEVOS_HEADLESS_COMMIT=1`). But it also blocks
a human who wants the agent to commit on their behalf. Today the only routes are the human's
own terminal or stripping agent markers, which is the bypass the gate exists to stop.

## Principle

A script check cannot tell "the user asked" from "the agent decided". The approval has to come
through a channel the agent cannot write to. In Claude Code that channel is the permission
prompt. We verified these points against the official docs on 2026-10-25:

- An explicit `ask` rule prompts in every mode, including auto and `bypassPermissions`
  (code.claude.com/docs/en/permission-modes, "Actions no mode auto-approves").
- Rules are evaluated deny, then ask, then allow, so an allow rule cannot cancel the ask
  (code.claude.com/docs/en/permissions).
- A rule matches the command text, not the program. `bash .agents/scripts/commit.sh` would not
  match `Bash(.agents/scripts/commit.sh *)`, so the Dev-OS hook must force the canonical form.

## Design

1. **Policy** `commitPolicy` in `.agents/manifest.json`:
   - `human` is the default and keeps the 5.0 behaviour.
   - `agent` means agents may commit through commit.sh, and each commit is approved through the
     Claude Code permission prompt.
   - Set it with `devos commit-policy <human|agent>` or `devos init --commit-policy <...>`.
   - Switching to `agent` is refused from an agent shell, so the opt-in is the human's.
2. **Ask rule**: `Bash(.agents/scripts/commit.sh *)` is always merged into `permissions.ask`.
   In human mode it is harmless; in agent mode it is the approval.
3. **commit.sh agent path**: `.agents/scripts/commit.sh --agent "<conventional message>"`. Allowed
   only when all of these hold:
   - policy is `agent`;
   - the shell is Claude Code: `CLAUDECODE` is set and no other harness marker is set, since the
     other harnesses have no equivalent un-bypassable prompt;
   - `.claude/settings.json` holds the ask rule;
   - the script was invoked as `.agents/scripts/commit.sh` from the repo root, which rules out a
     copied or renamed script;
   - something is staged and the message is a valid Conventional Commit.

   It then runs `git commit` with `DEVOS_COMMIT_APPROVED=true DEVOS_AGENT_COMMIT=1`.
4. **pre-commit hook**: an agent marker is tolerated only with `DEVOS_AGENT_COMMIT=1`, policy
   `agent`, and a Claude Code marker. Secret, env and DB scans run as before.
5. **PreToolUse hook**:
   - It blocks any invocation of commit.sh that is not the canonical `.agents/scripts/commit.sh ...`
     form (`bash`, `sh`, `source`, `./`, an absolute path), so the ask rule always matches.
   - `DEVOS_AGENT_COMMIT` joins the self-approval variables that may not be assigned inline.
   - For the canonical form it also returns `permissionDecision: "ask"`, as a second prompt
     source if the settings rule was removed.
6. **doctor** reports the policy and whether the ask rule is wired.
7. **Docs**: AGENTS.md Rules 6 and 8, `/commit` command, git-ops skill, README, CHANGELOG 5.1.0.

## Revision (same day, human feedback)

The human does not want to run anything in a terminal; the agent should do everything, with the human approving in the loop. So:
- `agent` is the default whenever the Claude Code ask rule is wired. `human` is the default elsewhere.
- The agent-shell refusal on switching the policy is removed. The per-commit prompt is the approval, so the policy switch grants nothing by itself.
- `Bash(git push *)` is added as an ask rule, so pushes also need approval.

## Out of scope / residual

- Codex, Gemini and Cursor stay human-only. They have no documented ask rule that holds in every mode.
- The guard limits documented in 5.0 still apply. An interpreter running git directly is
  caught only by the pre-commit hook.

## Verification

- `npm test`: new smoke assertions for the policy command, the settings ask rule, the commit.sh
  agent path (allowed and refused cases), the pre-commit hook, and the hook canonical-form block.
- `npm run eval` stays green.
