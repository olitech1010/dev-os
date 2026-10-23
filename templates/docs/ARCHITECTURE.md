# Dev-OS System Architecture

## System Architecture Overview

Dev-OS uses a multi-agent hierarchy orchestrated by a central coordinator (the Orchestrator). AI outputs are isolated by role and validated by parallel agents before human review.

### Agent Hierarchy and Communication Flow

```mermaid
flowchart TD
    Human(Human Lead) --> Orchestrator
    
    subgraph EX["Execution"]
        Developer
        Tester
        DevOps
        DBA
    end
    
    subgraph QV["Quality and Validation"]
        QA
        Security
        Researcher
    end
    
    subgraph SM["Strategy and Memory"]
        Architect
        MemoryManager
        ReleaseManager
    end

    Orchestrator --> EX
    Orchestrator --> QV
    Orchestrator --> SM
```

### Standard Feature Delivery (Parallel Gate)

```mermaid
flowchart TD
    Task(New Task) --> Orch[Orchestrator]
    Orch --> Dev[Developer Writes Code]
    Dev --> Gate{Parallel Quality Gate}
    
    Gate --> QA[QA Agent Checks Code]
    Gate --> Tester[Tester Agent Runs Tests]
    Gate --> Sec[Security Agent Scans]
    
    QA --> Merge1{All Pass?}
    Tester --> Merge1
    Sec --> Merge1
    
    Merge1 -- No --> Dev
    Merge1 -- Yes --> Human[Human Approval]
    Human --> Deploy["DevOps / Merge"]
```

### Bug Fix Workflow

```mermaid
flowchart TD
    Bug(Bug Report) --> Researcher[Researcher Investigates]
    Researcher --> Dev[Developer Fixes Code]
    Dev --> Tester[Tester Writes Regression Test]
    Tester --> QA[QA Verifies]
    QA --> Human[Human Approval]
```

### Commit Gate Flow

```mermaid
flowchart LR
    Agent["Agent / Developer"] --> Stage[Stage changes and present summary]
    Stage --> Human[Human in own terminal]
    Human --> Script[commit.sh]
    Script --> Marker{Agent marker set?}
    Marker -- Yes --> Reject[Commit Refused]
    Marker -- No --> Approve[Type approve, type, message on /dev/tty]
    Approve --> Git[git commit with DEVOS_COMMIT_APPROVED=true]
    Git --> Hook[Pre-commit hook: agent check, token, scans]
    Hook -- Pass --> Success[Commit Saved]
    Hook -- Fail --> Reject
```

Agent shells (`CLAUDECODE`, `GEMINI_CLI`, `CODEX_*`, `CURSOR_AGENT`, `AI_AGENT`, and related markers) can never commit: `commit.sh`, the `pre-commit` hook, and the `pre-merge-commit` hook all refuse them. Headless commits (`DEVOS_HEADLESS_COMMIT=1`) work only with `CI=true`, in pipelines. Existing projects re-run `.agents/scripts/install-hooks.sh` (or `devos update`) to get the current hooks. Details: [PRE_COMMIT_HOOK.md](PRE_COMMIT_HOOK.md).

### Memory System Architecture

```mermaid
flowchart TD
    PinnedRules[Pinned Hard Rules] --> Context[Agent Context Window]
    CurrentState[CURRENT_STATE.md] --> Context
    Lessons[LESSONS.md] --> Context
    
    Context --> Execution[Agent Execution]
    Execution --> SharedMemory[Orchestrator: shared-memory skill]
    SharedMemory --> |Updates| CurrentState
    SharedMemory --> |Learns| Lessons
```

### Slash Command Routing

```mermaid
flowchart LR
    Command["/slash_command"] --> Orch[Orchestrator]
    Orch --> Parse[Read YAML Frontmatter]
    Parse --> Target[Target Agent]
    Target --> Workflow[Execute Workflow / Prompt]
```

### Runtime Lifecycle Hooks Flow (F1)

```mermaid
flowchart TD
    SessionStart[SessionStart Hook] --> Fetch[git fetch --all --prune]
    Fetch --> Digest[Display Hard Rules Digest]
    
    ToolInvocation[Tool Execution / Bash] --> PreToolUse{PreToolUse Hook}
    PreToolUse -- Destructive Command Blocked --> Abort[Abort & Require Dry-Run Plan]
    PreToolUse -- Raw git commit Blocked --> GateMsg[Redirect to commit.sh]
    PreToolUse -- Valid Command --> Execute[Execute Tool]
    
    SessionClose[SessionEnd Hook] --> StateCheck{CURRENT_STATE.md Updated?}
    StateCheck -- No & Code Modified --> Warn[Display Rule #13 Reminder]
    StateCheck -- Yes --> End[Clean Exit]
```

### Deterministic Task Board & DAG State (F4)

```mermaid
flowchart LR
    Backlog[BACKLOG] --> Queued[QUEUED]
    Queued --> InProgress[IN_PROGRESS]
    InProgress --> ParallelGate[PARALLEL_GATE]
    ParallelGate --> HumanCheck[HUMAN_CHECKPOINT]
    HumanCheck --> Done[DONE]
```

### Multi-Harness Engine (F5)

```mermaid
flowchart TD
    Core[Dev-OS Core: .agents/] --> Compiler[devos init / update]
    Compiler --> Claude[Claude Code: .claude/ + CLAUDE.md + hooks.json]
    Compiler --> Cursor[Cursor: .cursor/rules/devos.mdc + .cursorrules]
    Compiler --> OpenCode[OpenCode: OPENCODE.md + .opencode/rules/]
    Compiler --> Gemini[Gemini / Antigravity: GEMINI.md]
    Compiler --> Codex[Codex / Windsurf: .codex/ + .windsurfrules]
```

### Autonomous SDLC & Mandatory Design Gate (v4.0)

```mermaid
flowchart TD
    Idea["Product Idea / MVP Goal"] --> Stage1["1. Inception: Architect (grill-me) -> docs/PROJECT_REQUIREMENTS.md"]
    Stage1 --> Stage2["2. Design Gate: UI Designer (anti-ai-ui) -> DESIGN.md"]
    Stage2 --> Stage3["3. Schema & Seeds: DBA -> Migrations + Fixtures (devos123)"]
    Stage3 --> Stage4["4. Task DAG: Orchestrator -> docs/TASK_BOARD.md"]
    Stage4 --> Stage5["5. Implementation: Developer -> Code authoring"]
    Stage5 --> Stage6["6. Test Suite: Tester -> Unit/E2E Tests"]
    Stage6 --> Stage7["7. Testing Guide: Tester -> docs/TESTING_GUIDE.md"]
    Stage7 --> Stage8["8. QA Gate: QA -> Lint, Types & Design Gate Audit"]
    Stage8 --> Stage9["9. Security Gate: Security -> OWASP & Secrets Scan"]
    Stage9 --> Stage10["10. Humanizer: Tech Writer -> humanize-check.sh"]
    Stage10 --> FinalReview["Founder Delivery Briefing"]
```

### Telemetry & Root Cause Analysis (RCA) Feedback Loop

```mermaid
flowchart LR
    HookErr[Hook Failure / Circuit Breaker Trip] --> LocalLog[Local Buffer: .agents/telemetry/events.jsonl]
    LocalLog --> TelemetryAgent[Telemetry agent, maintainer pack: RCA Diagnosis]
    TelemetryAgent --> Sanitize[Sanitization & Privacy Gate: Strip Code & Secrets]
    Sanitize --> UpstreamPR[Automated Bug Report / PR to olitech1010/dev-os]
```

## Directory Structure

- `.agents/`: The core logic of the OS.
  - `agents/`: System prompts for each default agent persona (Orchestrator, Architect, PM, UI Designer, Developer, DBA, Tester, QA, Security, Researcher, DevOps, Tech Writer, Tech Lead).
  - `maintainer/`: Maintainer-pack agents and commands (Telemetry, Eval Engineer; `/telemetry`, `/eval`), not installed by default.
  - `commands/`: Slash commands (YAML frontmatter + instructions: `task.md`, `auto.md`, `design.md`, `humanize.md`, etc.).
  - `skills/`: Specialist engineering skills (`humanizer/`, `testing-guide/`, `autonomous-sdlc/`, `telemetry/`, etc.).
  - `hooks/`: Runtime lifecycle hooks (`session-start.sh`, `pre-tool-use.sh`, `session-end.sh`).
  - `memory/`: Shared memory vault (`decisions/ADRs`, `handoffs/`, `context.json`).
  - `telemetry/`: Local failure event buffer (`events.jsonl`).
  - `scripts/`: Tooling (`commit.sh`, `install-hooks.sh`, `humanize-check.sh`).
  - `packs.json`: Composable capability pack definitions.
  - `manifest.json`: Installed pack tracking, execution mode, telemetry configuration, and version metadata.
- `DESIGN.md`: Mandatory design system specification at project root, authored by the UI Designer with the `anti-ai-ui` skill.
- `CODING_STANDARDS.md`: Engineering quality standards and type safety policies at project root.
- `docs/`: Project documentation.
  - `PROJECT_REQUIREMENTS.md`: Scoped project spec generated by Architect via `grill-me`.
  - `TESTING_GUIDE.md`: Interactive human walkthrough guide with seed accounts and universal password `devos123`.
  - `TASK_BOARD.md`: Deterministic DAG task board state machine.
  - `CURRENT_STATE.md`: Single source of truth for active tasks and blockers.
  - `LESSONS.md`: Episodic memory and incident learnings.
- Multi-Harness Outputs:
  - `.claude/`: Claude Code commands, agents, and lifecycle hooks.
  - `.cursor/rules/`: Cursor MDC rule definition.
  - `.opencode/`: OpenCode configuration and rules.
  - `CLAUDE.md`, `OPENCODE.md`, `GEMINI.md`: Root harness guidance.

