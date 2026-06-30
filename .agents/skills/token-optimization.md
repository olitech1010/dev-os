---
name: token-optimization
description: Rules for minimizing token consumption across all agent interactions without sacrificing output quality. Applies to all agents to keep context focused and costs low.
---

# Token Optimization Skill

> **Goal**: Minimize token consumption across all agent interactions without sacrificing output quality.

## Why This Matters
Every agent interaction costs tokens. Unnecessary verbosity, redundant context loading, and multi-turn loops can 10x the cost of a task. This skill defines how all agents should behave to keep costs low.

## Rules for All Agents

### 1. Be Concise in Output
- No preamble. No "Sure, I'd be happy to help." Start with the answer.
- Use bullet points and tables over prose where possible.
- Do not repeat the question back in the response.

### 2. Single-Shot Over Multi-Turn
- Prefer one well-structured prompt that gets the full answer, over a chain of follow-up questions.
- When the Architect grills a project, it does so in a single zero-shot pass, not a simulated interview loop.

### 3. Load Only Relevant Context
- Do not load all agent prompts at once. Load only the prompt for the active agent.
- Do not load the full `CODING_STANDARDS.md` when only one section is relevant — reference the section name.
- Avoid pasting entire files into context when a line range or summary would suffice.

### 4. Minimize Intermediate Reporting
- Agents should report their final output, not narrate their thinking process step by step.
- The Orchestrator should summarize delegations in a single block, not one message per agent.

### 5. Reuse, Don't Repeat
- If a Researcher already confirmed a package version, do not ask the Researcher again in the same session.
- If a Reviewer approves code, do not re-review it unless the code changed.

### 6. Structured Output Formats
- Use the defined output templates (see each agent's prompt). Structured outputs are faster to parse, shorter, and more useful than free-form prose.


