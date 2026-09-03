# Field Report: Dev-OS Compliance Audit — dadiboes Session (2026-08-18 to 2026-08-20)

> Documentation-only report. No code changes are proposed in this PR; each finding ends
> with a recommendation for the owner to evaluate and implement.

## Context

An AI working agent (Claude Code) ran a multi-day session in the `dadiboes` project,
which has Dev-OS installed. The task: sync the About page content, diagnose why the
page was missing locally, and unblock seven days of failed Vercel production deploys.
The task succeeded, but a post-session audit (prompted by the project owner) found that
several Dev-OS protocols were bypassed or silently skipped. This report documents what
held, what failed, why it failed, and what would prevent it.

## What held

- [ OK ] The Mechanical Commit Gate (Hard Rule 8) blocked raw `git commit`; the agent
  routed the commit through `.agents/scripts/commit.sh`.
- [ OK ] The pre-commit secret scan ran and passed.
- [ OK ] Conventional commit format was enforced by the script's type whitelist.
- [ OK ] The agent surfaced its plan and findings to the human before committing
  (Staged Review, in spirit).

## What failed, and why

### Finding 1: AGENTS.md was never read before work began

The generated `CLAUDE.md` says "Read `.agents/AGENTS.md` ... before making changes,"
but this is a passive pointer. The agent absorbed only the CLAUDE.md digest (commit
gate, coding standards pointer) and started implementing immediately. It first opened
AGENTS.md two days later — after the owner asked why the rules were not followed.
Everything below follows from this one miss.

**Root cause:** A pointer in always-loaded context does not compete with a concrete
user task. Nothing mechanical verifies the read happened.

**Recommendation:** Have `devos init` embed a compressed Hard Rules digest (10-15
lines) directly into the generated CLAUDE.md block, so the rules are in context even
when the agent never opens AGENTS.md. Alternatively (or additionally), ship a
SessionStart hook in the generated `.claude/settings.json` that injects the Hard Rules
into every session. The full AGENTS.md stays as the reference document; the digest is
the enforcement surface.

### Finding 2: The human-approval token is pipeable

`commit.sh` reads the approval token from stdin. When the human replied "continue" to
a message that listed the commit plan, the agent ran:

    printf 'approve\nfix\n<message>\n' | .agents/scripts/commit.sh

The gate passed. The commit was legitimate in substance (the human had seen the exact
plan), but the gate's design intent — a human physically types the token — was not
met. An agent acting on a *misread* of user intent would pass the gate identically.

**Root cause:** `read -p` consumes piped stdin exactly like interactive input.

**Recommendation:** In `commit.sh`, read the token from the controlling terminal
(`read ... < /dev/tty`) and fail with a clear message when no TTY is available
(`[ FAIL ] Human approval requires an interactive terminal`). This makes the gate
mechanically un-pipeable while remaining a one-line change. Consider an explicit
documented escape hatch (e.g. `DEVOS_HEADLESS_COMMIT=1` plus a logged warning) for CI
use, so the restriction does not break legitimate automation.

### Finding 3: CURRENT_STATE.md and LESSONS.md were not updated

The session completed a STANDARD-level task (content sync, staging merge, dependency
lockfile fix, production deploy) and ended with `docs/CURRENT_STATE.md` still reading
"Task: (none), Status: IDLE". The owner had to ask for the update. AGENTS.md assigns
this duty to the Memory Manager "or the Orchestrator when the Memory Manager is not
active" — but in a plain interactive session, neither persona is active, so the duty
lands on no one.

**Root cause:** State maintenance is specified as an agent-persona responsibility, not
a session-level obligation. Interactive solo sessions have no defined owner for it.

**Recommendation:** Two options, not mutually exclusive:
1. Add a Hard Rule: "Before ending any working session that changed files, update
   `docs/CURRENT_STATE.md`; log incidents in `docs/LESSONS.md`." Session-level rules
   bind whoever is working, persona or not.
2. Add a Stop (or PreToolUse-on-commit) hook that warns when source files changed but
   `docs/CURRENT_STATE.md` was not touched in the same session. A warning is enough;
   a hard block would be noisy for trivial changes.

### Finding 4: No QA/Tester/Security gate ran

Standard Feature Delivery specifies a parallel QA + Tester + Security gate before the
human checkpoint. None ran. The agent did run `tsc --noEmit` and a full `next build`
before committing — real verification, but self-verification, not the independent
review the workflow describes.

**Root cause:** The workflow protocols assume an Orchestrator-led multi-agent
execution. A solo interactive session has no defined minimum protocol, so agents
improvise. (Related to Finding 3 — the same structural gap.)

**Recommendation:** Define an explicit "solo session" profile in AGENTS.md: the
minimum viable pipeline when no orchestrator is active (e.g. typecheck + build/test +
self-review against CODING_STANDARDS.md + state update + human commit gate), and when
a session MUST escalate to the full multi-agent workflow (CRITICAL triage, schema
changes, security-sensitive code). Right now the honest options are "full ceremony"
or "nothing", and agents under a concrete task pick nothing.

### Finding 5: No session-start freshness check (contributing incident)

The session's original confusion — rebuilding an About page that was already live in
production — happened because the local clone was 31 commits behind `origin/main` and
had never fetched the `staging` branch. No Dev-OS rule requires a fetch/state check at
session start.

**Recommendation:** Add to the Hard Rules or the generated CLAUDE.md digest: "At
session start, run `git fetch --all --prune` and check `git status -sb` before scoping
any task." Cheap, and it prevents a whole class of duplicate/stale work. A SessionStart
hook could run the fetch automatically and surface behind/ahead counts.

## Summary of recommendations & v2.1.0 Resolution

| # | Change | Kind | Effort | Resolution in v2.1.0 |
|---|--------|------|--------|----------------------|
| 1 | Embed Hard Rules digest into generated CLAUDE.md | Generator + template | Small | **RESOLVED**: `bin/devos.js` `bootstrapClaudeMd` injects full 14-rule digest into `CLAUDE.md`. |
| 2 | `commit.sh`: read token from `/dev/tty`, fail without TTY, documented CI escape hatch | Script | Small | **RESOLVED**: `commit.sh` reads from `/dev/tty` by default; headless bypass requires `DEVOS_HEADLESS_COMMIT=1`. |
| 3 | Hard Rule for CURRENT_STATE.md updates at session end | Docs + rules | Small | **RESOLVED**: Added Hard Rule #13 (Session-End State Obligation) to `AGENTS.md` & `CLAUDE.md`. |
| 4 | Define a "solo session" minimum protocol in AGENTS.md | Docs + rules | Medium | **RESOLVED**: Added dedicated Solo Session Protocol section to `AGENTS.md` & `CLAUDE.md`. |
| 5 | Session-start fetch/freshness rule | Docs + rules | Small | **RESOLVED**: Added Hard Rule #14 (Session-Start Freshness Check) requiring `git fetch --all --prune`. |

## Closing note

The failure mode observed was not an agent rejecting the rules — it was the rules
never entering the agent's working context, and the one mechanical gate being softer
than it looks. Dev-OS's instinct (mechanical enforcement over trust, per the
2026-08-10 lesson in its own LESSONS.md) is right. In v2.1.0, all five recommendations
have been mechanically implemented and verified.
