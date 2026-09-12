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
    Dev["Agent / Developer"] --> Script[commit.sh]
    Script --> Token[Export DEVOS_COMMIT_APPROVED]
    Token --> Git[git commit]
    Git --> Hook[Pre-commit hook]
    Hook --> Gitleaks[gitleaks Secret Scan]
    Gitleaks -- Pass --> Success[Commit Saved]
    Gitleaks -- Fail --> Reject[Commit Rejected]
```

### Memory System Architecture

```mermaid
flowchart TD
    PinnedRules[Pinned Hard Rules] --> Context[Agent Context Window]
    CurrentState[CURRENT_STATE.md] --> Context
    Lessons[LESSONS.md] --> Context
    
    Context --> Execution[Agent Execution]
    Execution --> MemoryManager[Memory Manager Agent]
    MemoryManager --> |Updates| CurrentState
    MemoryManager --> |Learns| Lessons
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
    Stage1 --> Stage2["2. Design Gate: UI Designer (ui-ux-pro-max) -> docs/DESIGN.md"]
    Stage2 --> Stage3["3. Schema & Seeds: DBA -> Migrations + Fixtures (devos123)"]
    Stage3 --> Stage4["4. Task DAG: Orchestrator -> docs/TASK_BOARD.md"]
    Stage4 --> Stage5["5. Implementation: Developer -> Code authoring"]
    Stage5 --> Stage6["6. Test Suite: Tester -> Unit/E2E Tests"]
    Stage6 --> Stage7["7. Testing Guide: Tester -> docs/TESTING_GUIDE.md"]
    Stage7 --> Stage8["8. QA Gate: QA -> Lint, Types & Design Gate Audit"]
    Stage8 --> Stage9["9. Security Gate: Security -> OWASP & Secrets Scan"]
    Stage9 --> Stage10["10. Humanizer: Release Manager -> humanize-check.sh"]
    Stage10 --> FinalReview["Founder Delivery Briefing"]
```

### Telemetry & Root Cause Analysis (RCA) Feedback Loop

```mermaid
flowchart LR
    HookErr[Hook Failure / Circuit Breaker Trip] --> LocalLog[Local Buffer: .agents/telemetry/events.jsonl]
    LocalLog --> TelemetryAgent[Telemetry Agent: RCA Diagnosis]
    TelemetryAgent --> Sanitize[Sanitization & Privacy Gate: Strip Code & Secrets]
    Sanitize --> UpstreamPR[Automated Bug Report / PR to olitech1010/dev-os]
```

## Directory Structure

- `.agents/`: The core logic of the OS.
  - `agents/`: System prompts for each agent persona (Orchestrator, Developer, QA, Tester, DBA, DevOps, Architect, Researcher, Memory Manager, Release Manager, UI Designer, Executive Proxy, Telemetry, Eval Engineer).
  - `commands/`: Slash commands (YAML frontmatter + instructions: `task.md`, `auto.md`, `design.md`, `humanize.md`, `telemetry.md`, etc.).
  - `skills/`: Specialist engineering skills (`humanizer/`, `testing-guide/`, `autonomous-sdlc/`, `telemetry/`, etc.).
  - `hooks/`: Runtime lifecycle hooks (`session-start.sh`, `pre-tool-use.sh`, `session-end.sh`).
  - `memory/`: Shared memory vault (`decisions/ADRs`, `handoffs/`, `context.json`).
  - `telemetry/`: Local failure event buffer (`events.jsonl`).
  - `scripts/`: Tooling (`commit.sh`, `install-hooks.sh`, `humanize-check.sh`).
  - `packs.json`: Composable capability pack definitions.
  - `manifest.json`: Installed pack tracking, execution mode, telemetry configuration, and version metadata.
- `docs/`: Project documentation.
  - `DESIGN.md`: Mandatory design system specification extracted from `ui-ux-pro-max`.
  - `TESTING_GUIDE.md`: Interactive human walkthrough guide with seed accounts and universal password `devos123`.
  - `TASK_BOARD.md`: Deterministic DAG task board state machine.
  - `CURRENT_STATE.md`: Single source of truth for active tasks and blockers.
  - `LESSONS.md`: Episodic memory and incident learnings.
- Multi-Harness Outputs:
  - `.claude/`: Claude Code commands, agents, and lifecycle hooks.
  - `.cursor/rules/`: Cursor MDC rule definition.
  - `.opencode/`: OpenCode configuration and rules.
  - `CLAUDE.md`, `OPENCODE.md`, `GEMINI.md`: Root harness guidance.

