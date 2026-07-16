---
name: task-contract
description: Defines the standard contract format for sub-task delegation between agents.
---

# Task Contract

When delegating a task to another agent, you MUST provide a contract in this format:

```
[TASK CONTRACT]
To: <Agent Role>
From: <Your Role>
Task: <Short Name>

## Context
Provide necessary context, links to CODING_STANDARDS.md, or prior work.

## Deliverable
Exactly what must be produced (e.g. file paths, test results).

## Acceptance Criteria
1. Must pass tests...
2. Must follow standards...
3. ...

## Boundary
What the agent should NOT do (e.g. do not touch DB schema).
```
