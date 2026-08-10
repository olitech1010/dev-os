# Slash Commands Reference

Slash commands are pre-configured triggers that route tasks to specific agents with predefined rules, tools, and prompts.

## Command System Overview

Commands are defined in `.agents/commands/`. When you use a slash command (e.g., `/review`), the Orchestrator reads the corresponding markdown file and routes the request to the target agent immediately.

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
- **Description**: Trigger the autonomous commit workflow.
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
- **Triage Level**: CRITICAL
- **Workflow**: direct
- **Usage**: `/secure`

### `/research`
- **Description**: Investigate docs, CVEs, or package info.
- **Target Agent**: Researcher
- **Triage Level**: STANDARD
- **Workflow**: direct
- **Usage**: `/research Next.js 14 App Router caching`

### `/status`
- **Description**: Summarize the current project state.
- **Target Agent**: Memory Manager
- **Triage Level**: TRIVIAL
- **Workflow**: direct
- **Usage**: `/status`

### `/fix`
- **Description**: Initiate the Bug Fix workflow.
- **Target Agent**: Orchestrator
- **Triage Level**: STANDARD
- **Workflow**: bugfix
- **Usage**: `/fix The login button doesn't respond on mobile`

### `/architect`
- **Description**: Incept a new feature or project.
- **Target Agent**: Architect
- **Triage Level**: CRITICAL
- **Workflow**: inception
- **Usage**: `/architect We need a new admin dashboard for user management`

### `/refactor`
- **Description**: Start exploratory refactoring on a throwaway branch.
- **Target Agent**: Developer
- **Triage Level**: STANDARD
- **Workflow**: direct
- **Usage**: `/refactor Rewrite the auth module using the new Context API`

### `/deploy`
- **Description**: Trigger DevOps for deployment planning and execution.
- **Target Agent**: DevOps
- **Triage Level**: CRITICAL
- **Workflow**: direct
- **Usage**: `/deploy production`

## Creating Custom Commands

To create a new command:
1. Create a `.md` file in `.agents/commands/`.
2. Add the required YAML frontmatter.
3. Add the instructions for the agent below the frontmatter.
