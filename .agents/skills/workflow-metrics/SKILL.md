---
name: workflow-metrics
description: Guidelines for tracking agent performance, loop counts, and error rates.
---

# Workflow Metrics

Agents must keep track of their own execution metrics to prevent infinite loops and token waste.

## Loop Limits
- **Reviewer Feedback Loops:** Max 2 times. If Developer fails to address Reviewer feedback after 2 attempts, escalate to Orchestrator/Human.
- **Test Fix Loops:** Max 3 times. If tests fail 3 times in a row, Developer must stop and ask Human for help.

## Metric Reporting
When completing a major task, optionally summarize:
- Prompt/Completion tokens used (if known/estimable)
- Number of iterations it took to pass Reviewer
- Number of test failures encountered
