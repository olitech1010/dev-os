---
name: google-agents-cli-adk-code
description: "Use when writing Python agent code with Google's Agent Development Kit (ADK): defining agents, adding tools, callbacks, orchestration patterns, and state management. Not for project scaffolding or deployment; those upstream sibling skills are not shipped with Dev-OS."
metadata:
  source: https://github.com/google/agents-cli
  author: Google
  license: Apache-2.0
  version: 1.0.0
  requires:
    bins:
      - agents-cli
    install: "uv tool install google-agents-cli"
license: Apache-2.0
---

# ADK Code Reference

> **Dev-OS note:** Dev-OS ships only `google-agents-cli-workflow` and `google-agents-cli-adk-code` (optional `google-adk` pack). The sibling skills `google-agents-cli-scaffold`, `-eval`, `-deploy`, `-publish`, and `-observability` referenced below are **not shipped**. Install them from upstream with `uvx google-agents-cli setup` if needed, or use the `agents-cli` command help and https://adk.dev docs instead.

> **Before using this skill**, activate `/google-agents-cli-workflow` first — it contains the required development phases and scaffolding steps.

## Prerequisites

1. Run `agents-cli info` — if it shows project config, skip to the reference below
2. If no project exists: run `agents-cli scaffold create <name>`
3. If user has existing code: run `agents-cli scaffold enhance .`

Do NOT write agent code until a project is scaffolded.

> **Python only for now.** This reference currently covers the Python ADK SDK.
> Support for other languages is coming soon.

## Quick Reference — Most Common Patterns

```python
from google.adk.agents import Agent

def get_weather(city: str) -> dict:
    """Get current weather for a city."""
    return {"city": city, "temp": "22°C", "condition": "sunny"}

root_agent = Agent(
    name="my_agent",
    model="gemini-flash-latest",
    instruction="You are a helpful assistant that ...",
    tools=[get_weather],
)
```

---

## References

The first two are cheatsheets for common patterns; for broad or deep knowledge, go to the source (docs index or installed package).

| Reference | When to read |
|------|-------------|
| `references/adk-python.md` | Core ADK API: `Agent`, tools, callbacks, plugins, state, artifacts, multi-agent systems, `SequentialAgent` / `ParallelAgent` / `LoopAgent`, custom `BaseAgent`, A2A protocol, A2UI. Default for most agents. |
| `references/adk-workflows.md` | Graph-based Workflow API (ADK 2.0): nodes, edges, fan-out/fan-in, HITL, parallel processing. Use when you need explicit graph topology. |
| `curl https://adk.dev/llms.txt` | Docs index (every page title + URL). Fetch it, then `WebFetch` the specific page for anything beyond the cheatsheets. |
| Installed ADK package | Exact signatures and symbols — inspect the source (see "Inspecting ADK Source Code" in `references/adk-python.md`). |

## Related Skills

- `/google-agents-cli-workflow` — Development workflow, coding guidelines, and operational rules
- `/google-agents-cli-scaffold` (not shipped) — Project creation and enhancement with `agents-cli scaffold create` / `scaffold enhance`
- `/google-agents-cli-eval` (not shipped) — Evaluation methodology, dataset schema, and the eval-fix loop
- `/google-agents-cli-deploy` (not shipped) — Deployment targets, CI/CD pipelines, and production workflows
