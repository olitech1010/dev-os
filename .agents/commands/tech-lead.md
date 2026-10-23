---
name: tech-lead
description: Arbitrate deadlocks and resolve circuit-breaker failure loops
agent: tech-lead
triage_level: CRITICAL
workflow: arbitration
argument-hint: "<arbitration context>"
---

Arbitrate an ongoing multi-agent impasse or resolve a circuit-breaker escalation.

1. Analyze the failed test/QA trajectory and previous developer attempts
2. Isolate the architectural conflict or missing edge-case logic
3. Issue one written, binding decision: a fix specification, a revised plan, or "ambiguous requirement". Do not write code patches; the Developer applies the decision
4. Escalate to Human Checkpoint only if business intent is contradictory

Arbitration context: $ARGUMENTS
