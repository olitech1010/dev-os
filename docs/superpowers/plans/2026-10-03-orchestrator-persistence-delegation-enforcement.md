# Implementation Plan: TASK-006 — Orchestrator Persistence & Delegation Enforcement

> Date: 2026-10-03
> Task: TASK-006
> Triage: STANDARD
> Owner: Orchestrator
> Status: APPROVED FOR IMPLEMENTATION

## Problem

Across agent-driven harnesses, Orchestrator mode is not reliably mounted unless the
human restates it every turn. Agents frequently skip subagent delegation, and the active
SDLC mode can silently switch. The mechanical commit gate holds because it is a shell
script; delegation and mode are enforced only by prose in `AGENTS.md` and generated
harness digests, which decay as context grows. This is the root cause already documented
in `docs/FIELD_REPORT_2026-08-20.md` (Finding 1) and
`docs/2026-09-12-devos-v4-roadmap-research.md` (Pillar 1, MREE).

## Root Causes

1. **Context rot.** Instructions load once at session start. There is no per-turn
   re-assertion of role, mode, or delegation duty.
2. **Mode is not a locked artifact.** `context.json` carries an `orchestratorMode` note,
   but no hook reads or enforces it. Mode can drift mid-session.
3. **Delegation is advisory.** `pre-tool-use.sh` enforces Destructive, Commit, and Design
   gates, but nothing blocks solo production-code authoring.
4. **Latent bug.** `pre-tool-use.sh:82` greps `\[IN_PROGRESS\]` while `TASK_BOARD.md`
   writes `[ IN_PROGRESS ]` (spaces). The task-board gate can never match.

## Approach

Move enforcement from advisory prose to runtime hook validation, following the existing
zero-dependency shell-hook architecture.

### 1. Session state lock — `.agents/memory/session.json`

A single, machine-readable session artifact written by `session-start.sh` and the
`devos mode` CLI:

```json
{
  "schemaVersion": "1.0.0",
  "startedAt": "<iso>",
  "updatedAt": "<iso>",
  "mode": "interactive",
  "orchestratorLocked": true,
  "delegationRequired": false,
  "switchedBy": "session-start"
}
```

- `orchestratorLocked` defaults to `true` (the Dev-OS premise).
- `delegationRequired` is `true` in `auto` and `guided` modes, or when
  `DEVOS_ENFORCE_ORCHESTRATOR=1`.

### 2. Per-turn re-injection — `.agents/hooks/user-prompt-submit.sh` (new)

Reads `session.json` and emits a compact directive block on every user turn:
active role (Orchestrator), locked mode, delegation mandate, and the commit gate. This is
the direct counter to "unless I keep telling it."

### 3. Orchestration Gate — extend `.agents/hooks/pre-tool-use.sh`

New gate that blocks production source writes when orchestration is enforced and no
`[ IN_PROGRESS ]` task with an `Assignee:` is declared in `docs/TASK_BOARD.md`.

- Production extensions: `ts,tsx,js,jsx,py,rb,go,rs,java,php,vue,svelte,sql`.
- Exempt paths: `.agents/`, `docs/`, `scripts/`, `tests/`, `*.config.*`, `*.test.*`,
  `*.spec.*`, markdown, and hooks.
- Escape hatch: `DEVOS_SOLO_APPROVED=true` (logged).
- Also fixes the task-board regex to `\[ IN_PROGRESS \]`.
- In `interactive` mode the gate warns instead of blocking; in `auto`/`guided` it blocks.

### 4. Mode-switch guard

Mode changes require an explicit `devos mode <mode>` invocation (which rewrites
`session.json` and logs the switch). The per-turn hook always reports the locked mode, so
silent switching is visible. No harness can silently re-mount a different mode without
rewriting the artifact.

### 5. Harness parity

- **Claude Code:** native `UserPromptSubmit` hook wired into `.claude/hooks.json`.
- **OpenCode:** directive embedded in `.opencode/rules/devos-rules.md` plus plugin hook
  documented; fallback is re-reading `session.json`.
- **Antigravity/Gemini, Cursor, Codex:** directive + mode line embedded in generated
  instruction files; no per-turn hook, so fallback applies.

### 6. CLI and command surface

- `devos mode [status|<mode>|lock|unlock]`.
- `/mode` slash command routing to the Orchestrator.

## Files

| File | Change |
|---|---|
| `.agents/memory/session.json` | New session state template |
| `.agents/hooks/session-start.sh` | Write/refresh session.json; display mode + lock |
| `.agents/hooks/user-prompt-submit.sh` | New per-turn re-injection hook |
| `.agents/hooks/pre-tool-use.sh` | Orchestration Gate + regex fix |
| `.agents/commands/mode.md` | New `/mode` command |
| `bin/devos.js` | `devos mode` CLI, UserPromptSubmit wiring, mode line in harness generators, help text |
| `scripts/smoke-test.js` | Assertions for hooks, session.json, mode CLI |
| `.agents/evals/suites/agent-authority.eval.json` + `scripts/eval-runner.js` | Enforcement eval cases |

## Verification

1. `node scripts/smoke-test.js` — all assertions pass.
2. `node bin/devos.js eval run` — `EVAL_PASSED`, no regression.
3. `devos mode auto` then attempt a production write with no active task → blocked.
4. `DEVOS_SOLO_APPROVED=true` → allowed with logged warning.
5. `session-start.sh` writes a valid `session.json`; `user-prompt-submit.sh` emits the
   directive.

## Rollback

Revert the commit. `session.json` is additive; removing the new hook from
`.claude/hooks.json` disables per-turn injection without affecting existing gates.

## Out of Scope

True subagent invocation cannot be observed uniformly across harnesses. This plan
enforces the orchestrator's routing artifact (task + assignee) and per-turn intent, not
proof that a specific subagent executed. The human checkpoint remains the backstop.
