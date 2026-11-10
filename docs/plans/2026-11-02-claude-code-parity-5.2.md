# Plan: Claude Code parity and cross-harness runtime (v5.2.0)

Status: APPROVED by the human on 2026-11-02 ("approved, continue approved").

## Goal

Make Dev-OS behave inside Claude Code the way Claude Code itself works (skills that load
themselves, hooks on the right events, subagents with their full frontmatter, a plugin that
stays in sync), and make Codex, Gemini CLI, Cursor and OpenCode get the same runtime
behaviour wherever those harnesses expose the hooks to do it.

The human's words: "add how Claude Code works exactly into devos, the superpowers, how they
automatically get loaded, integrate how Claude Code works so it can sync easily with Claude
Code, and also work just like Claude Code on other environments."

## What was verified (2026-11-02, official docs and the installed Superpowers 7.0.0 source)

### How Superpowers loads itself (the pattern to copy)

1. One `SessionStart` hook, matcher `startup|clear|compact`, runs `hooks/session-start`.
2. The script reads ONE bootstrap skill (`using-superpowers/SKILL.md`) and emits it as
   `hookSpecificOutput.additionalContext`, wrapped in `<EXTREMELY_IMPORTANT>`.
3. The bootstrap says: check for a skill before ANY action; here is the priority order.
   Every other skill loads on demand through the `Skill` tool, from its description.
4. The same script emits a different JSON shape per harness, chosen by env var:
   `CURSOR_PLUGIN_ROOT` gives `additional_context`, `CLAUDE_PLUGIN_ROOT` gives the nested
   `hookSpecificOutput`, anything else gives top-level `additionalContext`.
5. Every harness gets a thin manifest around the same `skills/` directory: `.claude-plugin`,
   `.codex-plugin`, `.cursor-plugin`, `.opencode`, `gemini-extension.json`, and others.
   OpenCode gets a JS plugin that registers the skills directory and injects the bootstrap.

### How Claude Code works (relevant mechanics)

- Skills: only name plus description sit in context; the body loads on invoke. Description
  plus `when_to_use` is cut at 1,536 characters per entry. Frontmatter Dev-OS does not use:
  `when_to_use`, `disable-model-invocation`, `user-invocable`, `paths`, `context: fork`,
  `agent`, `model`, `effort`, `hooks`, `disallowed-tools`. Skill edits are watched live.
- Hooks: 33 events. Dev-OS wires 7 (SessionStart, UserPromptSubmit, PreToolUse,
  PostToolUse, Stop, SubagentStop, SessionEnd). Unused and relevant: `PreCompact`,
  `PostCompact`, `SubagentStart`, `TaskCreated`, `TaskCompleted`, `InstructionsLoaded`,
  `PostToolBatch`, `FileChanged`, `CwdChanged`. Handler types are command, http, mcp_tool,
  prompt and agent. `if` filters hooks by permission-rule syntax.
- Memory: CLAUDE.md `@import` to 4 hops; `.claude/rules/*.md` with `paths:` load lazily;
  `AGENTS.md` is read ONLY when no CLAUDE.md exists above the working directory, which is why
  Dev-OS's CLAUDE.md imports it. Auto memory loads the first 200 lines or 25 KB.
- Subagents: Dev-OS agents use `name`, `description`, `tools`. Claude Code also takes
  `model`, `effort`, `maxTurns`, `skills` (preloaded, up to 32), `memory`
  (user, project, local), `isolation: worktree`, `disallowedTools`, `color`, `omitClaudeMd`,
  `background`. Plugin agents ignore `hooks`, `mcpServers` and `permissionMode`.
- Plugins: `userConfig`, `dependencies`, `bin/` on PATH, `monitors`, `settings.json` default
  agent, `${CLAUDE_PLUGIN_DATA}` that survives updates.

### Other harnesses (hooks now exist almost everywhere)

| Harness | Hook config | Context at session start | Can block a tool | Verified from |
|---|---|---|---|---|
| Codex | `.codex/hooks.json` or `config.toml`; project layer must be trusted, hooks reviewed via `/hooks` | `additionalContext` or plain stdout | Yes: PreToolUse deny or exit 2 (shell, apply_patch, MCP; not hosted tools) | learn.chatgpt.com/docs/hooks |
| Gemini CLI | `.gemini/settings.json` | Yes (SessionStart) | Yes: BeforeTool, `{"decision":"deny"}` or exit 2; stdout must be pure JSON | geminicli.com/docs/hooks |
| Cursor | `.cursor/hooks.json` | `additional_context`, but fire-and-forget | Yes: preToolUse and beforeShellExecution deny; `ask` only on the shell hook | cursor.com/docs/hooks |
| OpenCode | JS plugin | via plugin hook | via plugin | Superpowers' source only; NOT in official docs yet |

Skill discovery: Gemini CLI scans `.agents/skills/` natively (documented alias). Codex and
Cursor are not yet confirmed from docs; step P0 below settles them.

### Gaps found in Dev-OS today

1. Hooks are wired for Claude Code only. Every other harness gets a static instruction file:
   no gate, no per-turn orchestrator directive, no re-injection after compaction.
2. No bootstrap skill. The orchestrator text is injected, but nothing tells the model
   "check skills before acting", so skill auto-loading depends on the description alone.
3. Subagent files generate 3 frontmatter keys of the roughly 17 Claude Code reads.
4. `.claude-plugin/marketplace.json` builds 5.1.2 into a directory named `5.1.0`.
5. Plugin hooks and `devos init` hooks could both fire in a project that has both installed.
   `DEVOS_PLUGIN_MODE` stands the plugin down outside Dev-OS projects only. Unverified whether
   a project install suppresses it; P0 tests it.
6. No check that Dev-OS still matches Claude Code. The facts above will drift.

## Design

One core, thin adapters. The hook logic stays in `.agents/hooks/*.sh` and
`lib/hook-input.js`, which already normalise stdin JSON. Each harness gets an adapter that
(a) registers the events in that harness's file and (b) shapes the output the way that
harness expects. Where a harness lacks a capability, `devos doctor` says "advisory" instead
of pretending it is enforced.

### W1. Bootstrap skill and auto-loading
- New first-party skill `using-devos` (under 3 KB): check skills before acting, the skill
  priority order, roster pointer, Hard Rules digest pointer, per-harness tool names.
- `session-start.sh` injects it on `startup|clear|compact`, with the Superpowers-style
  per-harness output switch. Existing orchestrator and freshness output is kept.
- Coexistence: if Superpowers is installed, Dev-OS injects only the delta (orchestrator,
  rules) and skips a second "check skills" preamble, so the model is not told twice.

### W2. Skill frontmatter parity
- Add `when_to_use`, and `disable-model-invocation: true` on skills with side effects
  (deploy-to-vercel, expose-localhost, supabase writes), `paths:` on stack skills so they
  load only when matching files are touched, `allowed-tools` where a skill needs shell.
- `devos skill audit` gains: 1,536-character cap per entry, total listing size warning,
  description-starts-with-trigger check. Audit stays an error-free warning pass for vendored
  third-party skills (their text is not ours to rewrite; use a Dev-OS-side override file).
- Document `/reload-skills` after adding a top-level skills directory.

### W3. Hook expansion in Claude Code (four events, not nine)
- `PreCompact` / `PostCompact`: save and re-attach task and mode state (replaces the
  compact special case inside SessionStart).
- `SubagentStart`: inject the active task contract into every subagent.
- `TaskCompleted`: tick `docs/TASK_BOARD.md` and run the verify line.
- `InstructionsLoaded`: log which instruction files loaded, so `devos doctor` can prove the
  AGENTS.md import actually resolved.
- Not adopted: PermissionRequest, FileChanged, CwdChanged, PostToolBatch. Revisit on demand.

### W4. Subagent frontmatter parity
- Generate `model`, `effort`, `maxTurns`, `disallowedTools`, `color`, and `memory: project`
  for roles that benefit (researcher, tech-lead), plus `skills:` preload for 2 or 3 core
  skills per role. Source of truth stays `.agents/agents/*.md`; the generator maps fields.
- Never set `permissionMode` or `hooks` on plugin agents (ignored by Claude Code).

### W5. Claude Code sync
- Fix the stale `5.1.0` plugin output directory; derive it from the package version.
- Resolve plugin versus project double-firing (gap 5) with a marker file the project
  install writes and the plugin hooks check.
- `devos doctor` section "Claude Code conformance": the hook events, frontmatter keys and
  AGENTS.md rule Dev-OS depends on, compared to a pinned fixture in `.agents/evals/`. The
  fixture carries the doc URL and verification date. A scheduled GitHub Action re-fetches the
  docs and opens an issue on drift. The CLI itself stays zero-dependency and offline.

### W6. Cross-harness adapters
- Codex: write `.codex/hooks.json` (SessionStart, UserPromptSubmit, PreToolUse, Stop).
  `doctor` and `init` print the one-time `/hooks` trust step; without it the hooks do not run.
- Gemini CLI: merge hooks into `.gemini/settings.json` (SessionStart, BeforeAgent,
  BeforeTool, SessionEnd). Output is pure JSON on stdout; the shell scripts get a harness
  switch so no banner text leaks.
- Cursor: write `.cursor/hooks.json` (sessionStart, beforeSubmitPrompt, preToolUse,
  beforeShellExecution, stop). Note sessionStart cannot block and arrives late; the
  UserPromptSubmit-equivalent carries the orchestrator directive as well.
- OpenCode: ship a JS plugin only after its plugin API is confirmed from official docs.
  Until then OpenCode stays on AGENTS.md plus opencode.json and is labelled advisory.
- Commit policy `agent` stays Claude Code only. Cursor's shell hook could carry an `ask`,
  but that is a separate decision with its own plan.
- Shared skills: point harnesses that scan `.agents/skills/` at it directly instead of
  generating copies, once P0 confirms which ones do.

## Non-goals
- No new runtime dependency. The CLI stays zero-dependency (R12).
- No attempt to copy Claude Code features other harnesses lack (agent teams, `/compact`).
- No roster changes, no skill removals, no change to the commit policy.
- No claim of enforcement where a harness cannot block (Cursor sessionStart, hosted Codex tools).

## Anti-goals (failure even if it "works")
- A second copy of the rules per harness that drifts from `.agents/AGENTS.md`.
- Doubling the model's instructions when Superpowers is also installed.
- A hook that prints a banner and breaks Gemini's pure-JSON requirement.

## Phases and verification

| Phase | Work | Gate |
|---|---|---|
| P0 | Confirm from docs: Codex and Cursor skill directories, OpenCode plugin API; test plugin plus project double-firing; check which harnesses are installed locally for live tests | Findings appended to this plan |
| P1 | W1, W2, W5 fixes (version path, double-fire marker) | smoke green, `devos skill audit` 0 errors |
| P2 | W3, W4 | smoke green; fixtures for each new event payload |
| P3 | W6 Codex, Gemini, Cursor adapters; fixtures per payload shape | smoke green; live check in each harness found at P0 |
| P4 | W5 conformance fixture and doctor section; docs; CHANGELOG; 5.2.0 | full smoke, eval, tarball check |

Every phase ends with `npm test`. Each adapter gets a payload fixture test in
`scripts/smoke-test.js`, because the shapes differ and silent drift is the main risk.

## Calls I am making (override any of them)
1. One release, 5.2.0, built in the phase order above, committed per phase with your approval each time.
2. OpenCode deferred until its plugin API is confirmed from official docs.
3. Bootstrap yields to Superpowers when both are installed.
4. Four new Claude Code events, not all nine.
5. Commit policy untouched.

## Risks
- Codex project hooks need a one-time trust step from the human; Dev-OS cannot do it for them.
- Hook payload shapes differ per harness; mitigated by fixtures, not by assumption.
- Doc facts drift; mitigated by the conformance fixture and scheduled check.
- A larger bootstrap costs tokens every session; capped at 3 KB and measured in the smoke test.

## Phase 0 findings (2026-11-02)

### Skill directories: `.agents/skills/` is already native almost everywhere

| Harness | Scans `.agents/skills/` | Also scans | Evidence |
|---|---|---|---|
| Codex | yes: CWD up to repo root, plus `~/.agents/skills` | `/etc/codex/skills` | learn.chatgpt.com/docs/build-skills |
| Cursor | yes, plus nested subfolders | `.cursor/skills`, `.claude/skills`, `.codex/skills` | cursor.com/docs/context/skills |
| OpenCode | yes, walks up to the git worktree | `.opencode/skills`, `.claude/skills` | opencode.ai/docs/skills |
| Gemini CLI | yes (alias, wins over `.gemini/skills`) | `.gemini/skills` | geminicli.com/docs/cli/skills |
| Claude Code | NO | `.claude/skills` only | code.claude.com/docs/en/skills |

Consequence: Claude Code is the only harness that needs the `.claude/skills/<name>` links
Dev-OS already writes. The other four read the source directory with no generation step.
Do not generate per-harness skill copies. OpenCode and Cursor scan both `.agents/skills` and
`.claude/skills`; those links resolve to the same files, so expect each skill to be listed
once or twice depending on how they de-duplicate. Add a live check on OpenCode (installed).

Frontmatter that works outside Claude Code: Cursor reads `paths` and
`disable-model-invocation`; Codex uses an optional `agents/openai.yaml` with
`policy.allow_implicit_invocation`; OpenCode and Gemini read only name, description, license,
compatibility, metadata and ignore the rest. So W2 frontmatter is safe everywhere (unknown
keys are ignored) and fully effective in Claude Code and Cursor. Codex needs the yaml sidecar
to get the same "explicit only" behaviour, which W2 will generate for side-effect skills.

Listing budgets differ: Codex caps the skill list at 2% of context (8,000 characters if the
window is unknown). With 23 core skills the descriptions must stay short. W2's audit enforces
Claude Code's 1,536-character cap and adds a total-size warning for the Codex budget.

### Double-firing is real

Claude Code docs: "If you define the same handler in more than one settings file, it runs
once. A plugin's or skill's copy of the same handler stays separate." Matching hooks run in
parallel. Plugin hooks and project hooks use different command strings, so in a project that
has both the Dev-OS plugin and `devos init`, every hook runs twice in parallel: duplicate
context injection, double telemetry, and a race on `.agents/memory/session.json`.
Current gate (`devos_plugin_gate` in `lib/common.sh`) stands down only when
`.agents/manifest.json` is absent. Fix in W5: the plugin stands down whenever the project
install owns the hooks, meaning `manifest.hooksEnabled !== false` AND `.claude/settings.json`
references `.agents/hooks/`. A smoke test installs both and counts hook runs.

### OpenCode (now partly confirmed, scope amended)

Documented: plugins in `.opencode/plugins/` load at startup; hooks `tool.execute.before`
(throw to block; can edit `output.args`), `tool.execute.after`, `session.created`,
`session.compacted`, `experimental.session.compacting` (appends `output.context`),
`permission.asked`, `shell.env`. NOT documented: injecting context at session start
(Superpowers uses the undocumented `experimental.chat.messages.transform`).
Amendment: ship an OpenCode plugin that does enforcement only (`tool.execute.before` mapped
to the existing pre-tool-use gate, compaction context via `experimental.session.compacting`),
and deliver the bootstrap through `opencode.json` `instructions`, which Dev-OS already
writes. Reason this is in scope now: OpenCode 1.18.35 is installed here, so it can be tested
live. Say no and it returns to deferred.

### What can be tested live on this machine

| Harness | Installed | Test plan |
|---|---|---|
| Claude Code 2.1.316 | yes | live: run hooks in a scratch project |
| OpenCode 1.18.35 | yes | live: plugin loads, a blocked tool call is blocked |
| Cursor | app only, no CLI | payload fixtures; human opens a scratch project to confirm |
| Codex | NO (`codex` on PATH is an unrelated static-site tool) | payload fixtures only |
| Gemini CLI | NO | payload fixtures only |

Adapters for the three harnesses we cannot run will ship labelled "fixture-verified, not
live-verified" in `devos doctor` and the docs, with the exact manual check for the human.

## Phase 1 result (2026-11-02)

Done and verified (full smoke green, `devos skill audit` 54 skills, 0 errors, notices coverage clean):

- W1: `using-devos` bootstrap skill (about 2 KB, in the core pack). `session-start.sh` injects it
  at session start and after compaction. Superpowers is detected from `enabledPlugins` in
  `~/.claude/settings.json`, `.claude/settings.json` or `.claude/settings.local.json`; when it
  is enabled only a 3-line Dev-OS delta is printed. `DEVOS_SUPERPOWERS=on|off` overrides.
- W5 (part): the plugin gate now stands down when the project's `.claude/settings.json` wires
  `.agents/hooks/`, ending the parallel double-run. The marketplace `--out` directory now
  carries the package version, and a smoke check keeps it in sync.
- W2 (reduced scope): `disable-model-invocation: true` plus a Codex `agents/openai.yaml`
  (`allow_implicit_invocation: false`) on `deploy-to-vercel` and `expose-localhost`; the audit
  warns on a listing entry over 1,536 characters and reports total listing size.

Scope calls made while building, for you to override:
1. `paths:` frontmatter on stack skills is dropped. Claude Code and Cursor would then surface a
   skill only after the agent touches a matching file, so "create a Laravel migration" in an
   empty repo would not see the Laravel skills. The context saved is small (the core listing is
   6.4 KB), and it means editing about ten vendored files. Not worth the risk.
2. `when_to_use` is supported by the audit but not added to any skill; no description needed it.
3. Supabase is not made manual-only: it is read-heavy and its writes already wait on human gates.
4. `devos init` into a project: the 24th core skill (`using-devos`) installs by default.

## Phase 2 result (2026-11-06)

Done and verified: smoke 515/515 (exit 0), `devos skill audit` 54 skills / 0 errors,
`npm run eval` EVAL_PASSED.

Re-verified before implementing, because the plan's facts were four days old and the CLI had
moved from 2.1.316 to 2.1.319: the hook event enum inside the installed binary, then each
event's payload and output contract from code.claude.com/docs/en/hooks and
code.claude.com/docs/en/sub-agents. Two plan assumptions were wrong and the design changed:

1. **PostCompact cannot inject context.** It has no decision control and no
   `additionalContext`; its stdout is discarded. W3 said PreCompact/PostCompact would "save and
   re-attach task and mode state (replaces the compact special case inside SessionStart)".
   The SessionStart `compact` branch therefore STAYS — it is the only thing that can re-inject
   after compaction. PreCompact got the other half of the job: its stdout is used as the
   compaction summary instructions (cap 10,000 characters per hook), so it tells the summariser
   what to keep rather than telling the model what to do.
2. **InstructionsLoaded has no `instruction_files` array.** It fires once per file with
   `file_path`, `memory_type`, `load_reason` (session_start, nested_traversal, path_glob_match,
   include, compact), plus `globs`, `trigger_file_path` and `parent_file_path`. The log is
   per-file and truncates at the first `session_start` load of a new session.

W3, five events in four work items (all wired without a matcher, so each covers every
matcher value; TaskCompleted supports no matcher at all):

- `pre-compact.sh` — summary instructions + `.agents/memory/compact-state.json`. Never blocks:
  refusing an auto-compact that is recovering from a context-limit error makes the request fail.
- `post-compact.sh` — records the compaction and the summary's size. The summary text itself is
  deliberately not written to disk (conversation content, not ours to persist).
- `subagent-start.sh` — injects the task contract as `hookSpecificOutput.additionalContext`
  (plain stdout is not read on this event). Opt-out `DEVOS_SUBAGENT_CONTRACT=off`.
- `task-completed.sh` — logs every closure; refuses one with exit 2 only when
  `DEVOS_TASK_VERIFY` is set (to `1` for the project's npm verify/test script, or to a command).
- `instructions-loaded.sh` — per-file log, read by a new `devos doctor` section
  "Instruction load (InstructionsLoaded hook)" that proves the CLAUDE.md -> AGENTS.md import
  resolved. Opt-out `DEVOS_INSTR_LOG=off`.

Shared helpers moved into `.agents/hooks/lib/common.sh`: `devos_project_root`,
`devos_hook_field`, `devos_active_task`, `devos_session_mode`, `devos_json_escape`.

W4: the generator now passes through and VALIDATES the documented subagent keys — `tools`,
`disallowedTools`, `model` (aliases including `fable`, plus full ids like `claude-opus-5-5`),
`effort`, `maxTurns`, `autoCompactWindow`, `skills`, `memory`, `isolation`, `color`,
`omitClaudeMd`, `background` — and drops `permissionMode`, `hooks`, `mcpServers` and
`initialPrompt` with a notice, so the `.claude/agents/` and plugin copies stay identical (a
plugin-provided agent ignores all four). `experimental` (`cacheTtl`) is not handled either way.
A `skills:` name that is not installed is dropped with a warning (Claude Code would only
note it in the debug log). Roster values added: `color` on all 15 personas, `effort: high` on
tech-lead, and 1-2 core-pack `skills:` preloads per role.

Scope calls made while building, for you to override:
1. `maxTurns` and `disallowedTools` are supported by the generator but set on no persona. Every
   agent already carries a `tools` allowlist, and a turn cap truncates real work silently.
2. `effort` is raised on tech-lead only. It runs once per Circuit Breaker arbitration, so the
   cost is bounded; raising it across the roster would raise the price of every delegation.
3. TaskCompleted does not tick `docs/TASK_BOARD.md`. A hook silently rewriting a tracked doc
   fights the human's own edits and would land outside the staged-review rule (R6). It records
   to an untracked log instead.
4. Verification on task completion is opt-in, not default. Running the suite on every closure
   would add minutes to each one and block work the human never asked to have blocked.
5. `.agents/hooks/lib/common.sh` now holds the task/mode readers, and `session-start.sh` keeps
   its own inline copies of that logic: refactoring a Phase 1 file that is already uncommitted
   would mix the two phases' diffs for no behavioural gain. Worth folding together in P4.

Still open from Phase 1, unchanged: the core skill listing is 15,519 characters of names and
descriptions, which fits Claude Code but is roughly double Codex's 8,000-character budget when
the context window is unknown. The audit reports it; nothing trims it yet.

## Phase 2 review and fix pass (2026-11-06)

A fresh-context reviewer checked the work against the official docs and the installed binary.
It confirmed every interface claim in the five hook headers and the W4 key table, and found
defects worth a fix pass. All gates re-run green afterwards: smoke 534/534 (51.9s),
`devos skill audit` 54 skills / 0 errors, `npm run eval` EVAL_PASSED.

Two findings were real design errors in what Phase 2 first shipped:

1. **`memory:` silently widens a persona's tool allowlist.** Claude Code adds Read, Write and
   Edit to any subagent with a memory scope ("so the subagent can manage its memory files"),
   confirmed in the 2.1.319 frontmatter parser. The plan named researcher and tech-lead for
   `memory: project`, and both describe themselves as read-only — tech-lead is the role that
   arbitrates Circuit Breaker trips without writing patches. **`memory:` is now set on no
   persona**, and the side effect is documented where a future maintainer would re-add it.
   Scope note recorded too: `project` writes to `.claude/agent-memory/` (meant to be
   committed), `local` to `.claude/agent-memory-local/` (not).
2. **The instruction-load "proof" could not fail, and could report a stale success.** The test
   matched `AGENTS.md` anywhere in doctor's output, including its own
   `[ PASS ] Team roster (.agents/AGENTS.md)` line, so it passed with no log at all. And the
   log's per-session truncation depended on SessionStart winning a race against an event the
   docs describe as asynchronous; once it lost, a row from an earlier session could keep
   proving an import that had since broken. Rows now carry `session_id`, doctor reads only the
   newest session's rows, and four assertions pin the no-log, CLAUDE.md-only, stale-session and
   proven cases.

Also fixed: `compact-state.json` was invalid JSON for a double quote in a branch name (git
permits it) or a tab in a task line, and an unquoted `set -- $(...)` globbed a mode of `*` into
the file — every value now goes through one escaper, so the three competing implementations are
down to one. `post-compact.sh` used an unbounded `cat` where the documented command-hook
timeout is 600 seconds. `DEVOS_TASK_VERIFY=1` picked its command by grepping package.json text,
so a dependency named `verify` made the gate refuse tasks in a project with no verify script;
it now parses the file and stays advisory when neither script exists. `devos_json_escape`
relied on awk `gsub` replacement semantics, which differ between BWK awk and gawk — on gawk it
would have emitted invalid JSON and Claude Code would have dropped the whole subagent contract
silently; it is now a character scan with no replacement semantics. Full model ids were being
rejected (`us.anthropic.claude-opus-4-5-v1:0`, `claude-sonnet-4-5@20250929`) and silently
replaced by an inherited model; `isolation: remote` is accepted alongside `worktree`.

Deferred, with the reviewer's reasoning, for P4 or later:
- Four inline copies of the session.json parsing (session-start, user-prompt-submit,
  pre-tool-use, common.sh), and `common.sh` ignores `DEVOS_ENFORCE_ORCHESTRATOR` where
  `session-start.sh` honours it. This is the fold-together already flagged above, now with two
  more call sites than first thought.
- The init summary row spells out all twelve event names by hand rather than deriving them.
- `skills:` does not refuse to preload a `disable-model-invocation` skill, which Claude Code
  will not preload (Phase 1 just put that flag on two skills).
- InstructionsLoaded is asynchronous, so parallel appends can race with the 400-line trim.

**Cost the plan approved but never quantified:** a `skills:` preload injects the skill's full
text on every spawn of that agent — ui-designer 13.4 KB (about 3,350 tokens), security 11.7 KB,
qa and tester 9.2 KB each, architect 7.3 KB, developer 5.0 KB. That is 1-3k tokens on every
delegation to those roles, paid whether the skill is used or not, and it is larger than the
`effort: high` decision the first appendix did flag. Worth a look before 5.2.0 ships.

## Phase 3 result (2026-11-09)

W6 done and verified: smoke 575/575 (exit 0), `devos skill audit` 54 skills / 0 errors,
`npm run eval` EVAL_PASSED. Four adapters ship; the fifth was dropped as obsolete.

Design as built: one core, thin adapters. Every harness runs the SAME `.agents/hooks/`
scripts. An adapter only registers the events in that harness's config file and tags the
command with `DEVOS_HOOK_FORMAT=<harness>`, which `lib/common.sh` turns into the reply shape
that harness documents (`devos_emit_context`, `devos_say`/`devos_flush_context`,
`devos_block`). The harness is never guessed from env markers — guessing is wrong exactly
when two harnesses share a checkout. Payload differences are folded into the Claude Code
spelling once, in `normalizeHarnessPayload` inside `lib/hook-input.js`.

The generated command resolves its own script from the git top level rather than an absolute
path, because these config files get committed and an absolute path breaks every other clone.

### Gemini CLI is retired; the adapter targets Antigravity CLI

geminicli.com/docs/hooks carries the banner "Gemini CLI was replaced by Antigravity CLI on
June 18th, 2026". The plan's W6 ("merge hooks into `.gemini/settings.json`; SessionStart,
BeforeAgent, BeforeTool, SessionEnd") targets a product retired five months before this phase
was built, and the live product differs in file, event names, nesting and output shape.
Antigravity CLI instead:
- `.agents/hooks.json` at the project root — a FILE beside Dev-OS's own `.agents/hooks/`
  script directory, which is why the smoke test asserts both still exist side by side.
- A NAMED bundle (`{"devos": {"enabled": true, ...}}`), unlike every other harness, with
  lifecycle handlers directly under the event key and matcher groups only for the tool events.
- Six events: SessionStart, PreToolUse, PostToolUse, PreInvocation, PostInvocation, Stop. No
  UserPromptSubmit, no subagent events, no compaction pair, no SessionEnd. Dev-OS wires four.
- No `additionalContext` anywhere: context goes in `injectSteps[].systemMessage`, and
  PreToolUse needs a REQUIRED `{"decision":"deny"}` — exit 2 is not documented as a denial, so
  `devos_block` emits the JSON decision for this harness and exit 2 for the others.
No legacy Gemini CLI hooks are written. `GEMINI.md` is untouched, so a user still on the old
CLI keeps today's advisory behaviour.

### Codex needed almost nothing new

Ten of the twelve Dev-OS hooks map 1:1, Codex uses the same nested matcher groups and the same
snake_case payload fields as Claude Code, its SessionStart takes plain stdout, and PreToolUse
blocks on exit 2 — so the existing scripts work there unchanged. Only two Dev-OS events have no
Codex equivalent (InstructionsLoaded, TaskCompleted). Timeouts are seconds, and SessionEnd caps
at 3, which the fixture asserts. The human must run `/hooks` once to trust the hooks, and again
after a `devos update`, because trust is tied to each script's hash; `init` and `doctor` now say so.

### Cursor: flat schema, snake_case replies

`{"version": 1, "hooks": {"<camelCaseEvent>": [handler, ...]}}` — `version` is required and the
handler lists are flat, not matcher groups. Nine events wired. `beforeShellExecution` is
deliberately NOT wired: `preToolUse` already covers shell calls, and wiring both would run the
gate twice on every command and double its telemetry.

### OpenCode: live-verified, and the plan's hook names were wrong

Built from the INSTALLED `@opencode-ai/plugin` typings (1.18.26), because the plugin API doc
pages 404 and the third-party write-ups contradict each other. Corrections to Phase 0:
- `permission.asked` does not exist; it is `permission.ask`.
- `session.created` and `session.compacted` are not hooks; session lifecycle arrives through
  the generic `event` hook.
- `tool.execute.before`'s output carries only `args`, so THROWING is the only way to refuse a
  call — the third-party claims about `output.proceed` or `output.status` do not match the typings.
- Better than the plan's amendment: `experimental.chat.system.transform` appends to the system
  prompt, so the directive is injected properly rather than relying only on `opencode.json`
  `instructions`.

Live checks against OpenCode 1.18.35 in a scratch install:
- `opencode debug config` shows `plugin: [".../.opencode/plugins/devos.js"]`, so the plugin is
  auto-discovered at that path, and `instructions: [".agents/AGENTS.md"]` resolved.
- `opencode debug startup` completes clean, with no plugin or config error.
- All three hooks exercised directly: the system prompt gets the Dev-OS directive (1,015
  chars), `rm -rf /` is refused by a throw carrying "Dev-OS Policy Violation (Hard Rule 1)",
  `git status -sb` passes, and the compaction hook contributes context naming the active task.

A bug the live test earned: Dev-OS was suppressing its own bootstrap on OpenCode because it
found Superpowers enabled in Claude Code's `settings.json`. Superpowers is a Claude Code plugin
and is not loaded anywhere else, so the yield is now Claude-Code-only and every other harness
gets the full bootstrap. Phase 1 shipped that bug; only running a second harness exposed it.

### Correction to a Phase 0 finding: OpenCode does not see `.agents/skills/`

Phase 0 recorded, from opencode.ai/docs/skills, that OpenCode scans `.agents/skills/` natively
and that no generation step was needed. Measured here with `opencode debug skill` in an
OpenCode install: the only skills listed are built-ins and the user's global
`~/.claude/skills`. Probe skills planted as real directories in `.agents/skills/`,
`.claude/skills/` and `.opencode/skills/` were all absent from the listing. So on an
OpenCode-only install the Dev-OS skills are not available as skills; the rules still arrive in
full through `opencode.json` `instructions` -> `.agents/AGENTS.md`, and the plugin injects the
directive, so behaviour is governed — but a skill is not invocable by name there.
Caveat: `debug skill` is the only observable available without a model call, so this measures
what that command reports, not necessarily what a live session resolves. Worth one re-check
before 5.2.0 ships, and worth re-testing the same way on Codex and Cursor, whose equivalent
claims in Phase 0 came from the same kind of doc reading.

### Deferred
- The generated OpenCode plugin is ESM in a `.js` file with no `package.json` declaring
  `"type": "module"`. Bun (OpenCode's runtime) loads it fine — verified — but plain Node emits
  a MODULE_TYPELESS_PACKAGE_JSON warning and reparses it. Cosmetic today; naming it `.mjs`
  would risk auto-discovery, which only documents `.ts` and `.js`.
- Cursor's `preCompact` returns only `user_message`, so `pre-compact.sh` stdout is ignored
  there; it still records state. Labelled advisory rather than removed.
- Antigravity's PreInvocation/PostInvocation (its per-turn events) are not wired; the
  UserPromptSubmit directive has no equivalent there yet.

## Phase 4 result (2026-11-09) — plan complete

W5's conformance work, the docs, the CHANGELOG and the 5.2.0 bump are done. All gates green:
smoke 596/596 (exit 0, 152s), `devos skill audit` 54 skills / 0 errors, `npm run eval`
EVAL_PASSED, `node scripts/check-conformance.js` exit 0, and the tarball checks out —
`@olives/devos@5.2.0`, 897 files, about 8.6 MB unpacked, every new file present, no state leaked.

### The conformance fixture is binding, not documentation

`.agents/evals/conformance.json` records all 31 external facts this release rests on, each with
its doc URL and the date it was checked, plus which were measured against a binary, against
installed typings, or live. The smoke test and `scripts/check-conformance.js` then make it
binding in the only way that matters: **the CLI cannot wire a hook event, use an OpenCode
plugin hook, or drop a subagent frontmatter key that no recorded fact supports.** Adding one
without recording where it came from fails the suite.

This is aimed squarely at how this release actually went wrong. Three OpenCode hook names in an
approved plan did not exist; Gemini CLI was replaced by Antigravity CLI between two phases;
PostCompact could not do what the plan assigned it. Every one of those was a fact asserted
without a dated source, and every one cost a rebuild. The fixture makes that class of mistake
a test failure.

The checker also reports what it cannot stand behind: facts older than
`stalenessWarningDays` (120), and facts marked `suspect` — currently the Codex and Cursor skill
directory claims, which were read from docs and never measured, and whose OpenCode equivalent
proved wrong when it finally was. `devos doctor` prints the same three things per project.

`.github/workflows/harness-conformance.yml` runs on the 1st and 15th, re-reads each recorded
doc page, and opens (or comments on a single existing) issue when a page stops naming an event
Dev-OS wires. `--fetch` lives only in that script: `bin/devos.js` contains no `fetch(` at all,
and the suite asserts that, so the CLI stays offline and zero-dependency (R12).

### Version

5.2.0 across `package.json`, `VERSION`, `CLAUDE.md`, the README badge and publish note, and
both version strings in `.claude-plugin/marketplace.json`. `init` and `update` now copy the
fixture into target projects so `devos doctor` can read it there.

### What is deliberately NOT in 5.2.0

- No legacy Gemini CLI hook wiring (retired product; see the Phase 3 result).
- No `paths:` frontmatter on stack skills (Phase 1 ruling: it would hide a stack's skills until
  a matching file is touched, for about 6 KB of context).
- No `memory:` on any persona (Phase 2: it silently grants Write and Edit).
- No TaskCompleted board edits, and verification stays opt-in (Phase 2).
- `maxTurns` and `disallowedTools` are supported but set nowhere (Phase 2).
- Antigravity's PreInvocation/PostInvocation per-turn events are unwired (Phase 3).

### Open for the human before publishing

1. **Skill preload cost.** A `skills:` preload injects the skill's full text on every spawn of
   that agent: ui-designer 13.4 KB (about 3,350 tokens), security 11.7 KB, qa and tester 9.2 KB
   each, architect 7.3 KB, developer 5.0 KB. The plan approved preloads; the per-delegation
   cost was never quantified. Trimming the two heaviest is a one-line change per persona.
   **Resolved 2026-11-10 (human: "trim the heavy skill preloads").** The two heaviest
   preloads are removed: `skills: anti-ai-ui` from ui-designer and `skills: security-review`
   from security. Both skills stay installed and are read on demand. The ui-designer body
   already named the file by path at the point of use, so that preload was duplicating text
   the persona loads anyway; the line now says to read it in full. The security persona had
   no such pointer, so a short "Load the review method on demand" section was added that
   sends it to `SKILL.md` plus only the matching `references/` files for a full review, and
   tells it to skip the skill for a narrow request (one scanner, one dependency, one secret
   check). Saving: 13.4 KB per ui-designer spawn and 11.7 KB per security spawn, unconditional
   before, now paid only when the work needs it. The eight other roles keep their preloads;
   the next heaviest are qa and tester at 9.2 KB, which have no body pointer to fall back on.
   Gates after the change: smoke 624/624 exit 0, `devos skill audit` 54 skills / 0 errors,
   `npm run eval` EVAL_PASSED, and a clean `devos init --existing` whose generated
   `.claude/agents/security.md` and `ui-designer.md` carry no `skills:` key.
2. **The core skill listing is 15,519 characters** of names and descriptions. Fine for Claude
   Code; roughly double Codex's 8,000-character budget when the context window is unknown. The
   audit reports it; nothing trims it.
3. **Two suspect facts** (Codex and Cursor skill directories) want measuring on a machine that
   has those CLIs.
4. **npm publish needs a human**: the token in `~/.npmrc` was expired as of 5.1.x, so
   `npm login` is interactive and cannot be done from here.

## Final review and fix pass (2026-11-09)

A fresh-context reviewer read the whole branch against the primary sources. It confirmed the
output layer, the escaper, the generated config schemas, the Claude Code facts and the Phase 2
fixes, and it found defects worth a fix pass. All gates re-run green afterwards: smoke
624/624 (exit 0, 94s), `devos skill audit` 54 / 0 errors, `npm run eval` EVAL_PASSED,
`check-conformance.js` exit 0, tarball `@olives/devos@5.2.0` 897 files.

Two findings were severe, and both were the same mistake in different clothes: a gate written
for Claude Code's payload and matcher, carried onto harnesses that use neither.

1. **The Antigravity adapter enforced nothing.** Phase 3 folded the payload's outer field
   names but not its tool ARGUMENTS, which are PascalCase: the shell command arrives as
   `toolCall.args.CommandLine`, not `command`. So `tool_input.command` was empty, `analyze()`
   never ran, and the destructive, commit, commit.sh-canonicality, self-approval,
   marker-tamper and gate-state checks were all dead on that harness — `rm -rf /` passed.
   Meanwhile `devos doctor` and the CHANGELOG both claimed it was enforced. Re-verified the
   spellings against the docs, mapped `CommandLine` and `TargetFile`, and recorded the full
   arg table in the fixture so the next adapter cannot repeat it.
2. **The design and orchestration gates refused read-only calls** on Cursor, Antigravity and
   OpenCode. Claude Code's `PreToolUse` matcher (`Bash|Edit|Write|MultiEdit|NotebookEdit`) had
   always hidden that the gates were tool-name-agnostic; the new adapters fire on every tool,
   so reading or grepping a `.tsx` file in a project without `DESIGN.md` was blocked, with a
   refusal that told the model it was trying to *modify* the file. A file path now becomes a
   write target only for a tool that writes it: a known writer always, a known reader never,
   and an unrecognised tool only when it carries a content argument — so an unknown writing
   tool stays gated without refusing every unknown read. Verified live through the OpenCode
   plugin: `read`/`grep` of `src/App.tsx` allowed, `write` still refused, `rm -rf /` still
   refused.

Also fixed: the commit `ask` reply was printed on every harness, which is out of schema on
Cursor (so the one sanctioned commit path was likely blocked there), carries no `decision` for
Antigravity, and could concatenate with a deny into unparseable output — the agent commit path
is now refused outside Claude Code, where the approval prompt it depends on does not exist. The
two fail-closed refusals bypassed `devos_block` and so failed *open* on Antigravity. A
permitted Antigravity call now answers `{"decision":"allow"}`, since that harness marks
`decision` required. `subagent-start.sh` bypassed the output layer, giving Cursor a
Claude-shaped reply. The `lib/common.sh` fallback did not define `devos_hook_format`, so a
partial install printed an error and silently dropped all context on the JSON harnesses.
Cursor's `preToolUse` now sets `failClosed`, because Cursor otherwise lets the call through on
any crash, timeout or missing script. The OpenCode plugin failed open on a timeout. Cursor's
`beforeSubmitPrompt` is no longer wired at all: it has no `additional_context`, so the
per-turn directive was being dropped there — Cursor gets the directive at `sessionStart` only.
`isolation: remote` was removed; only `worktree` is documented, and shipping an unrecorded
value is precisely what the fixture exists to prevent.

**The conformance machinery itself was weaker than its own claim.** It regexed `bin/devos.js`
for the wired events, so a quoted key, a different indent or double quotes made it pass while
missing the event — three of four such variants defeated it. The Phase 4 appendix's claim that
an unrecorded event "fails the suite" was therefore false. The CLI now exports
`wiredHookEvents`, `openCodePluginHooks`, the emitted and dropped frontmatter keys and the
enumerated value lists, and both the checker and the suite read those live objects. All three
previously-defeating variants are now caught, and the enumerated values are checked too.

`--fetch` would also have cried wolf forever: it compared every wired event name against every
recorded doc page, including the skills, memory and config pages that legitimately never
mention events — six false drifts on the day the fixture was written. It now only event-checks
the page whose `covers` says it documents events. The workflow's issue title was dated, so the
de-duplication search never matched and every run would have filed a new issue; the title is
now stable.

Recorded rather than fixed: Antigravity's docs contradict themselves on the inject-step shape
(the SessionStart example nests `systemMessage` inside itself; the PreInvocation field table
shows a plain string beside `metadata`). Dev-OS emits the plain-string form, which matches the
field table. It is in the fixture as an unresolved open question, because guessing silently is
how this release got into trouble twice.

### Still deferred
- Five of the twelve hooks exit 0 with no warning when `lib/common.sh` is missing, so a partial
  install disables them invisibly; the other seven degrade loudly.
- The TRIVIAL fast path keys off the tool name `Edit`, which only Claude Code and Codex use, so
  it never applies on the other harnesses.
- `devos_say ""` marks the buffer non-empty, so a leading blank line survives a flush.
