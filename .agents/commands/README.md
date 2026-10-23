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
workflow: standard | bugfix | inception | trivial | arbitration | product-planning | documentation | infrastructure | autonomous-sdlc | spec-driven | direct
argument-hint: "<what the user should type after the command>"
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
| `agent` | Yes | Target agent. Must be a default-roster agent in `.agents/agents/`: `orchestrator`, `architect`, `pm`, `ui-designer`, `developer`, `dba`, `tester`, `qa`, `security`, `researcher`, `devops`, `tech-writer`, `tech-lead`. Maintainer commands in `.agents/maintainer/commands/` may also target the maintainer agents `telemetry` and `eval-engineer`. Names removed in 5.0 (`executive-proxy`, `sre`, `release-manager`, `memory-manager`) are resolved through the alias map in **Migration from 4.x** in `.agents/AGENTS.md`; do not use them in new commands |
| `triage_level` | Yes | `TRIVIAL`, `STANDARD`, or `CRITICAL` |
| `workflow` | No | Which delivery protocol to follow. Defaults to `standard`. Every value maps to a protocol in the **Workflow Key** in `.agents/AGENTS.md`: `standard`, `bugfix`, `inception`, `trivial`, `arbitration`, `product-planning`, `documentation`, `infrastructure`, `autonomous-sdlc`, `spec-driven`, `direct` |
| `argument-hint` | When the command takes input | Placeholder shown in the command picker. Commands that take input must also reference `$ARGUMENTS` in the body |

## Available Commands

See the individual `.md` files in this directory. Maintainer-only commands (`/eval`, `/telemetry`) live in `.agents/maintainer/commands/` and are installed only with the `maintainer` pack.
