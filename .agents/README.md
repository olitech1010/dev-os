# Agents Directory

This directory powers the intelligence of the Dev-OS, defining the agents, their behaviors, and their available tools.

## Contents

- `AGENTS.md`: The master roster and workflow protocol.
- `agents/`: Contains the system prompts for all specialized agents.
- `skills/`: Contains capabilities, integrations, and stack standards that agents use.
- `commands/`: Definitions for slash commands (`/test`, `/review`, etc.).
- `maintainer/`: Maintainer-only agents and commands, installed with the `maintainer` pack.
- `scripts/`: Essential workflow scripts, like `commit.sh` and `install-hooks.sh`.

## Agent Roster

- [Orchestrator](agents/orchestrator.md) (also leads Autonomous Mode, `/auto`)
- [Architect](agents/architect.md)
- [Product Manager](agents/pm.md)
- [UI Designer](agents/ui-designer.md)
- [Developer](agents/developer.md)
- [DBA](agents/dba.md)
- [Tester](agents/tester.md)
- [QA](agents/qa.md)
- [Security](agents/security.md)
- [Researcher](agents/researcher.md)
- [DevOps](agents/devops.md) (deployment, infrastructure, and reliability)
- [Tech Writer](agents/tech-writer.md) (docs and release, Humanizer owner)
- [Tech Lead](agents/tech-lead.md) (read-only arbiter)

Maintainer pack (not installed by default): [Telemetry](maintainer/agents/telemetry.md) and [Eval Engineer](maintainer/agents/eval-engineer.md), with the `/telemetry` and `/eval` commands in `maintainer/commands/`. Agent names removed in 5.0 are mapped in **Migration from 4.x** in [AGENTS.md](AGENTS.md).

## Slash Commands Quick Reference

Use these commands for targeted tasks. Each file in [commands/](commands/) is one command; full details are in the [Slash Commands Reference](../docs/SLASH_COMMANDS.md).

- `/review`, `/test`, `/secure`, `/research`: single-agent checks and research
- `/fix`, `/refactor`, `/commit`: code changes through the gates and the commit gate
- `/architect`, `/pm`, `/design`, `/redesign`: inception, product, and design work
- `/deploy`, `/sre`: deployment and infrastructure (DevOps)
- `/tech-writer`, `/humanize`: documentation and the Humanizer gate (Tech Writer)
- `/auto`, `/mode`, `/status`, `/task`, `/tech-lead`, `/skill`: modes, project state, arbitration, and skill management

## Skills Reference

Skills in `.agents/skills/` are modular capabilities (like `grill-me`, `git-ops`, `deployment-checklist`) that give agents specific expertise. Packs and skill aliases are defined in `packs.json`.

## Scripts Reference

- `.agents/scripts/commit.sh`: The approved mechanism for agents to commit code, ensuring human-in-the-loop review.
- `.agents/scripts/install-hooks.sh`: Installs pre-commit hooks (like `gitleaks`) to enforce the Mechanical Commit Gate.

## Full Documentation

See the root `docs/` folder:
- [Tutorial](../docs/TUTORIAL.md)
- [Architecture](../docs/ARCHITECTURE.md)
