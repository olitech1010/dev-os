# Slash Commands Reference

Slash commands are pre-configured triggers that route tasks to specific agents with predefined rules, tools, and prompts.

## Command System Overview

Commands are defined in `.agents/commands/`. When you use a slash command (e.g., `/review`), the Orchestrator reads the corresponding markdown file and routes the request to the target agent immediately.

## Claude Code Integration

Running `devos init` compiles the command definitions in `.agents/commands/` into `.claude/commands/`, so every command in this reference is natively available as a slash command inside Claude Code (e.g., typing `/review` in a Claude Code session). Pass `--no-claude` to `devos init` if you want to skip generating the `.claude/` integration files.

## Schema Explanation

Each command file uses YAML frontmatter to configure behavior:

```yaml
---
name: command-name
description: Short description shown in command picker
agent: target-agent-name
triage_level: TRIVIAL | STANDARD | CRITICAL
workflow: standard | bugfix | inception | direct
---

# Command prompt body
This is the pre-configured prompt sent to the agent.
Use $ARGUMENTS to reference user input after the command.
```

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Command trigger name (without `/`) |
| `description` | Yes | Human-readable description |
| `agent` | Yes | Target agent (e.g., `qa`, `developer`) |
| `triage_level` | Yes | `TRIVIAL`, `STANDARD`, or `CRITICAL` |
| `workflow` | No | Which delivery workflow to follow. Defaults to `standard` |

## Commands Reference

### `/review`
- **Description**: Request a comprehensive code review.
- **Target Agent**: QA
- **Triage Level**: STANDARD
- **Workflow**: direct
- **Usage**: `/review src/components/Button.tsx`

### `/commit`
- **Description**: Stage changes and propose a Conventional Commit message. The agent cannot commit; you run `.agents/scripts/commit.sh` from your own terminal to finish.
- **Target Agent**: Developer
- **Triage Level**: TRIVIAL
- **Workflow**: direct
- **Usage**: `/commit Added the new button component`

### `/test`
- **Description**: Generate or execute tests for a module.
- **Target Agent**: Tester
- **Triage Level**: STANDARD
- **Workflow**: direct
- **Usage**: `/test src/utils/math.js`

### `/secure`
- **Description**: Request a security audit.
- **Target Agent**: Security
- **Triage Level**: STANDARD
- **Workflow**: direct
- **Usage**: `/secure`

### `/research`
- **Description**: Investigate docs, CVEs, or package info.
- **Target Agent**: Researcher
- **Triage Level**: TRIVIAL
- **Workflow**: direct
- **Usage**: `/research Next.js 14 App Router caching`

### `/status`
- **Description**: Summarize the current project state.
- **Target Agent**: Orchestrator
- **Triage Level**: TRIVIAL
- **Workflow**: direct
- **Usage**: `/status`

### `/fix`
- **Description**: Initiate the Bug Fix workflow.
- **Target Agent**: Developer
- **Triage Level**: STANDARD
- **Workflow**: bugfix
- **Usage**: `/fix The login button doesn't respond on mobile`

### `/architect`
- **Description**: Incept a new feature or project.
- **Target Agent**: Architect
- **Triage Level**: STANDARD
- **Workflow**: inception
- **Usage**: `/architect We need a new admin dashboard for user management`

### `/refactor`
- **Description**: Refactor code in the specified scope, with all existing tests passing and QA review before merge.
- **Target Agent**: Developer
- **Triage Level**: STANDARD
- **Workflow**: standard
- **Usage**: `/refactor Rewrite the auth module using the new Context API`

### `/deploy`
- **Description**: Trigger DevOps for deployment planning and execution.
- **Target Agent**: DevOps
- **Triage Level**: CRITICAL
- **Workflow**: infrastructure
- **Usage**: `/deploy production`

### `/task`
- **Description**: Inspect or update the deterministic task board DAG.
- **Target Agent**: Orchestrator
- **Triage Level**: STANDARD
- **Workflow**: standard
- **Usage**: `/task` or `/task list`

### `/auto`
- **Description**: Launch autonomous SDLC mode to build an MVP from an idea hands-off.
- **Target Agent**: Orchestrator (Autonomous Mode)
- **Triage Level**: STANDARD
- **Workflow**: autonomous-sdlc
- **Usage**: `/auto Build an offline-first markdown note taking application with full-text search`

### `/design`
- **Description**: Match authentic brand design systems from catalog (VoltAgent/awesome-design-md) and apply DESIGN.md at project root.
- **Target Agent**: UI Designer
- **Triage Level**: STANDARD
- **Workflow**: standard
- **Usage**: `/design Minimalist developer portfolio with terminal aesthetics`

### `/redesign`
- **Description**: Orchestrate multi-agent UI redesign refactoring existing frontend components to match updated DESIGN.md.
- **Target Agent**: Orchestrator
- **Triage Level**: STANDARD
- **Workflow**: standard
- **Usage**: `/redesign`

### `/humanize`
- **Description**: Audit and scrub AI writing tells from documentation and marketing copy.
- **Target Agent**: Tech Writer
- **Triage Level**: STANDARD
- **Workflow**: documentation
- **Usage**: `/humanize docs/README.md`

### `/telemetry` (maintainer pack)
- **Description**: Inspect local failure logs and generate RCA diagnostics. Installed only with the `maintainer` pack.
- **Target Agent**: Telemetry
- **Triage Level**: TRIVIAL
- **Workflow**: direct
- **Usage**: `/telemetry`, `/telemetry report`, or `/telemetry issue --dry-run`

### `/eval` (maintainer pack)
- **Description**: Run capability benchmarks, measure pass@k reliability, and generate agent scorecards. Installed only with the `maintainer` pack.
- **Target Agent**: Eval Engineer
- **Triage Level**: STANDARD
- **Workflow**: direct
- **Usage**: `/eval` or `/eval gates`

### `/mode`
- **Description**: Inspect or switch the locked SDLC execution mode and orchestrator delegation requirement.
- **Target Agent**: Orchestrator
- **Triage Level**: TRIVIAL
- **Workflow**: direct
- **Usage**: `/mode` or `/mode auto`

### `/sre`
- **Description**: Design infrastructure-as-code, SLOs, alerting, and incident runbooks.
- **Target Agent**: DevOps
- **Triage Level**: CRITICAL
- **Workflow**: infrastructure
- **Usage**: `/sre Add SLOs and alerting for the checkout API`

### `/pm`
- **Description**: Formulate user stories, acceptance criteria, and the MVP boundary.
- **Target Agent**: PM
- **Triage Level**: STANDARD
- **Workflow**: product-planning
- **Usage**: `/pm Team invitations by email`

### `/spec`
- **Description**: Write a feature spec in `docs/specs/<slug>/`: requirements with EARS acceptance criteria, a design, and a dependency-ordered task list, with a human checkpoint after each phase. The approved `tasks.md` serves as the implementation plan.
- **Target Agent**: Architect
- **Triage Level**: STANDARD
- **Workflow**: spec-driven
- **Usage**: `/spec password-reset by email`

### `/tech-writer`
- **Description**: Author technical documentation, ADRs, changelogs, and release notes.
- **Target Agent**: Tech Writer
- **Triage Level**: TRIVIAL
- **Workflow**: documentation
- **Usage**: `/tech-writer Document the new billing API`

### `/tech-lead`
- **Description**: Arbitrate a deadlock or Circuit Breaker trip with one written, binding decision (read-only, no code patches).
- **Target Agent**: Tech Lead
- **Triage Level**: CRITICAL
- **Workflow**: arbitration
- **Usage**: `/tech-lead Login test keeps failing after 3 fixes`

### `/skill`
- **Description**: Audit, list, sync, or discover agent skills.
- **Target Agent**: DevOps
- **Triage Level**: TRIVIAL
- **Workflow**: direct
- **Usage**: `/skill audit`

## Creating Custom Commands

To create a new command:
1. Create a `.md` file in `.agents/commands/`.
2. Add the required YAML frontmatter.
3. Add the instructions for the agent below the frontmatter.
