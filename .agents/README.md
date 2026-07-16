# Agents Directory

This directory powers the intelligence of the Dev-OS.

- `AGENTS.md`: The master roster and workflow protocol.
- `agents/`: Contains the system prompts for all 8 specialized agents (Orchestrator, Architect, Developer, Reviewer, Tester, DevOps, Security, Researcher).
- `skills/`: Contains the capabilities, integrations, and stack standards that the agents can use.

## Customizing
To add a new agent, create a markdown file in `agents/` and register it in `AGENTS.md`.
To add a new skill, create a new directory in `skills/` with a `SKILL.md` file.
