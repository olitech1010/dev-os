# Agents Directory

This directory powers the intelligence of the Dev-OS, defining the agents, their behaviors, and their available tools.

## Contents

- `AGENTS.md`: The master roster and workflow protocol.
- `agents/`: Contains the system prompts for all specialized agents.
- `skills/`: Contains capabilities, integrations, and stack standards that agents use.
- `commands/`: Definitions for slash commands (`/test`, `/review`, etc.).
- `scripts/`: Essential workflow scripts, like `commit.sh` and `install-hooks.sh`.

## Agent Roster

- [Orchestrator](agents/orchestrator.md)
- [Architect](agents/architect.md)
- [Developer](agents/developer.md)
- [Researcher](agents/researcher.md)
- [QA](agents/qa.md)
- [Tester](agents/tester.md)
- [DBA](agents/dba.md)
- [DevOps](agents/devops.md)
- [Security](agents/security.md)
- [Memory Manager](agents/memory-manager.md)
- [Release Manager](agents/release-manager.md)

## Slash Commands Quick Reference

Use these commands for targeted tasks. Full details in [Slash Commands Reference](../docs/SLASH_COMMANDS.md).

- `/review` ([view](commands/review.md))
- `/commit` ([view](commands/commit.md))
- `/test` ([view](commands/test.md))
- `/secure` ([view](commands/secure.md))
- `/research` ([view](commands/research.md))
- `/status` ([view](commands/status.md))
- `/fix` ([view](commands/fix.md))
- `/architect` ([view](commands/architect.md))
- `/refactor` ([view](commands/refactor.md))
- `/deploy` ([view](commands/deploy.md))

## Skills Reference

Skills in `.agents/skills/` are modular capabilities (like `grill-me`, `git-ops`, `deployment-checklist`) that give agents specific expertise. 

## Scripts Reference

- `.agents/scripts/commit.sh`: The approved mechanism for agents to commit code, ensuring human-in-the-loop review.
- `.agents/scripts/install-hooks.sh`: Installs pre-commit hooks (like `gitleaks`) to enforce the Mechanical Commit Gate.

## Full Documentation

See the root `docs/` folder:
- [Tutorial](../docs/TUTORIAL.md)
- [Architecture](../docs/ARCHITECTURE.md)
