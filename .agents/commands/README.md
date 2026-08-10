# Dev-OS Slash Commands

Slash commands are pre-configured triggers that route tasks to specific agents with predefined rules, tools, and prompts.

## How It Works

1. User types a command like `/review src/auth/`
2. The Orchestrator parses the command name and arguments
3. The matching command file (e.g., `review.md`) is loaded
4. The task is routed to the specified agent with the command's pre-configured prompt

## Command Schema

Each command is a Markdown file in `.agents/commands/` with YAML frontmatter:

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

### Frontmatter Fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Command trigger name (without `/`) |
| `description` | Yes | Human-readable description |
| `agent` | Yes | Target agent: `orchestrator`, `developer`, `qa`, `tester`, `security`, `devops`, `researcher`, `architect`, `dba` |
| `triage_level` | Yes | `TRIVIAL`, `STANDARD`, or `CRITICAL` |
| `workflow` | No | Which delivery workflow to follow. Defaults to `standard` |

## Available Commands

See individual `.md` files in this directory.
