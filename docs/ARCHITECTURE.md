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

## Directory Structure

- `.agents/`: The core logic of the OS.
  - `agents/`: System prompts for each agent.
  - `commands/`: Slash commands.
  - `skills/`: Agent capabilities.
  - `scripts/`: Tooling (e.g., `commit.sh`).
- `docs/`: User documentation.
- `src/` (or similar): The actual project source code being managed.
