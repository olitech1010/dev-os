# Dev-OS Gap Analysis vs ECC (+ DeepSeek Harness & Other Agentic Workflow Patterns)

## Scope
This document compares current Dev-OS capabilities to patterns found in:
- ECC (`affaan-m/ecc`)
- DeepSeek Harness (`deepseek-ai/deepseek-harness`)
- Broader agentic orchestration references (LangGraph, AutoGen, CrewAI, repository-harness)

Goal: identify concrete upgrade opportunities for Dev-OS in agents, skills, hooks, memory, and graph-style orchestration.

## Executive Summary
Dev-OS has strong foundational workflow discipline (clear role separation, staged quality gates, human approval). Its biggest opportunity is to evolve from a mostly **linear workflow policy** into a **stateful graph-orchestrated runtime** with:
1. richer agent specialization,
2. evented hooks beyond commit time,
3. shared durable memory for collaborative agents,
4. installable capability packs and profile-driven setup,
5. measurable reliability/eval loops.

## Current Dev-OS Baseline (Observed)
- Agent personas: **11** (`.agents/agents/*.md`)
- Skills: **60** (`.agents/skills/*`)
- Slash commands: **10** (`.agents/commands/*.md`)
- Hook/enforcement model today: pre-commit gate via `.agents/scripts/install-hooks.sh` + `.agents/scripts/commit.sh`
- Generated integration model: `.agents/commands` + `.agents/agents` compiled to `.claude/commands` and `.claude/agents` via `devos init`.

## ECC / DeepSeek Signals Relevant to Dev-OS

### ECC patterns worth extracting
- Large specialization surface (declared: **68 agents, 286 skills, 94 commands**) with harness-specific adapters and shared core behaviors.
- Runtime hook graph with lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, `PreCompact`, `Stop`, `SessionEnd`) and profile-based control (`minimal/standard/strict`).
- Explicit memory persistence lifecycle and a dedicated **unified-memory** skill for cross-harness handoffs.
- Install/runtime manifests (`.claude/ecc-tools.json`) including dependency graph + managed file ownership for safer upgrades and uninstall behavior.
- Multi-agent coordination patterns (`dmux-workflows`, codex multi-agent role configs).

### DeepSeek Harness patterns worth extracting
- “Everything is a plugin” capability seams and composition by profile/bundle rather than hardcoded monolith behavior.
- Event-centric architecture and durable session event logs as a system of record.
- Clear extension-point taxonomy for tools, agents, sessions, workflows, and providers.
- Experimental team coordination seam (task board + mailbox concept) as a graph-like collaboration primitive.

### Broader agentic workflow ecosystem signals
- LangGraph emphasis: durable execution, stateful agents, long/short memory, human-in-the-loop checkpoints.
- AutoGen/CrewAI emphasis: orchestrated multi-agent teams, event-driven flows, observability/tracing.
- repository-harness emphasis: repository-as-source-of-truth, explicit authority boundaries, proof-driven completion.

## Gap Matrix: Dev-OS vs Upgrade Opportunities

| Area | Dev-OS today | Gap | Upgrade direction |
|---|---|---|---|
| Agent specialization | 11 general team roles | Missing domain micro-agents and execution modes | Add tiered role catalog (core + optional domain packs) |
| Skills architecture | Rich but mostly static skills | No package/dependency model for skills | Introduce installable skill packs with dependency graph |
| Hooks | Commit gate + secret scan at commit-time | Missing session/tool lifecycle hooks | Add runtime hook pipeline (pre/post tool, session lifecycle, compaction) |
| Orchestration model | Workflow docs define linear steps | No runtime DAG/state machine of tasks | Introduce graph execution engine with explicit node states and transitions |
| Memory | `CURRENT_STATE.md` + `LESSONS.md` | No structured shared memory ledger across agents/sessions | Add durable memory vault (project/team/user scopes, typed entries, handoff protocol) |
| Multi-agent collaboration | Conceptual routing via Orchestrator | No shared task board/mailbox state | Add agent collaboration primitives (task queue, mailbox, ownership locks) |
| Eval/reliability | QA/Tester/Security flow exists | No formal pass@k/eval harness | Add eval-driven workflow + regression suites + run scorecards |
| Observability | Minimal workflow visibility | No execution trace graph/metrics | Add event logs, step traces, failure taxonomy, token/cost telemetry |
| Install/update lifecycle | `devos init` copies templates | No ownership manifest/conflict-safe updater | Add managed-files manifest + guided update/migrate flow |
| Cross-harness parity | Claude generation exists | Limited first-class Codex/other harness ergonomics | Add harness adapters + parity matrix + capability flags |

## Recommended Feature Upgrades for Dev-OS

## 1) Graph Engineering Core (highest impact)
Build a graph-based orchestration layer where every task is a DAG:
- nodes: planner, researcher, implementer, reviewer, tester, security, deploy-check,
- edges: dependency, approval, retry,
- node states: queued/running/blocked/failed/passed,
- policies: retry budgets, circuit breaker, escalation.

Expected outcome: less manual orchestration overhead, clearer parallelism, deterministic resumability.

## 2) Shared Memory Vault + Handoff Protocol
Add a structured memory subsystem that supports:
- scoped memory (`project`, `team`, optional `user`),
- typed documents (`context`, `decision`, `handoff`, `lesson`, `risk`),
- provenance metadata (author agent, source files, confidence, timestamp),
- search/read/write/doctor commands.

Expected outcome: collaborating agents can inherit context safely without overloading prompt windows.

## 3) Runtime Hook Framework (beyond pre-commit)
Introduce event hooks inspired by ECC lifecycle:
- `SessionStart`, `PreToolUse`, `PostToolUse`, `PreCompact`, `Stop`, `SessionEnd`.
- profile controls: `minimal`, `standard`, `strict`.
- hook registry for local scripts with safe defaults and explicit opt-ins.

Expected outcome: proactive enforcement and automation throughout the session, not only at commit time.

## 4) Capability Pack System for Skills/Agents
Move from static template copy toward composable packs:
- pack manifest (`id`, `version`, `dependsOn`, `files`, `conflictsWith`),
- optional packs (security-hardening, eval, data-science, mobile, enterprise-governance),
- install/update/remove with ownership tracking.

Expected outcome: lean default install, scalable specialization, safer updates.

## 5) Reliability and Eval Layer
Create a first-class eval workflow:
- define capability evals + regression evals per major feature change,
- pass@k tracking for agent workflows,
- gating rules (“cannot mark complete if required eval suite regresses”),
- longitudinal scorecards per agent role/workflow.

Expected outcome: quantifiable confidence in autonomous execution quality.

## 6) Multi-Agent Collaboration Primitives
Add shared operational state:
- task board (who owns what, status, blockers),
- mailbox/events for cross-agent requests,
- artifact contracts (what output format each handoff requires),
- conflict prevention (file locks/intents or explicit ownership claims).

Expected outcome: better parallel execution with fewer duplicate/conflicting edits.

## 7) Harness Parity Strategy
Define first-class harness adapters (Claude, Codex, Cursor, others) with:
- support matrix by capability (agents, skills, hooks, memory, MCP),
- adapter-specific constraints and generated outputs,
- compatibility tests for generated surfaces.

Expected outcome: Dev-OS behaves predictably across environments, not only Claude-first.

## Suggested New/Expanded Dev-OS Agent Set
Keep current core, add optional packs:
- **Planning/Control**: graph-orchestrator, dependency-manager, loop-operator
- **Quality**: eval-engineer, regression-guardian, benchmark-analyst
- **Memory/Knowledge**: memory-curator, handoff-auditor, decision-librarian
- **Security/Governance**: policy-enforcer, secret-hygiene-auditor, compliance-reviewer
- **Domain packs**: language/framework reviewers (Go, Python, Java, Rust, Laravel, mobile)

## Suggested New Skill Families
- graph-workflow-design
- workflow-runtime-observability
- shared-memory-operations
- handoff-contracts
- eval-driven-development
- postmortem-pattern-extraction
- harness-parity-testing
- pack-authoring-and-versioning

## Suggested Hook Profiles
- **minimal**: commit gate + secret scan + session summary
- **standard**: minimal + post-edit quality checks + compact reminders + activity tracking
- **strict**: standard + stronger tool-use blocking rules + expanded policy checks

## Implementation Phasing (for future work)

### Phase 1 — Foundation
- Define graph execution schema and state model
- Define memory document schema + storage locations
- Add runtime hook loader with profile support

### Phase 2 — Core Runtime
- Wire orchestrator to graph runtime
- Add task board/mailbox primitives
- Add lifecycle hooks and memory ingestion at session boundaries

### Phase 3 — Reliability + Ecosystem
- Add eval framework and scorecards
- Add capability-pack installer/updater with ownership manifests
- Add harness parity matrix + compatibility tests

## Risks / Trade-offs
- More runtime machinery increases complexity; must keep zero-dependency CLI constraints where required.
- Over-automation can weaken human governance if escalation policies are not explicit.
- Shared memory can become noisy without strict schemas and pruning/doctor tooling.
- Harness fragmentation risk if parity tests are not automated.

## Success Metrics for “Dev-OS better than today”
- Reduced manual intervention per feature delivery cycle.
- Higher first-pass completion rate of delegated tasks.
- Lower rework loops across Developer↔QA↔Tester.
- Faster cross-session recovery time (from interruption to productive resume).
- Measurable eval pass@k improvement and reduced escaped defects.

## Suggested Immediate Next Decisions
1. Choose memory scope model (`project/team/user`) and governance policy.
2. Decide graph engine location (CLI-native module vs skill runtime extension).
3. Decide initial hook event set and default profile.
4. Decide minimum viable capability-pack manifest schema.
5. Pick 3 pilot workflows to graphify first (feature delivery, bugfix, dependency update).

## References Analyzed
- Dev-OS local repository (`.agents/AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SLASH_COMMANDS.md`, `.agents/scripts/*`, `bin/devos.js`)
- ECC (`AGENTS.md`, `README.md`, `hooks/README.md`, `hooks/hooks.json`, `hooks/memory-persistence/*`, `.claude/ecc-tools.json`, `.codex/config.toml`, selected skills)
- DeepSeek Harness (`README.md`, `AGENTS.md`, `docs/architecture.md`, selected `.agents/skills/*`)
- Additional references: `langchain-ai/langgraph`, `microsoft/autogen`, `crewAIInc/crewAI`, `hoangnb24/repository-harness`
