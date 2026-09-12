---
name: telemetry
description: Inspect local telemetry events, analyze failures, or generate RCA feedback report
agent: telemetry
triage_level: TRIVIAL
workflow: direct
---

Inspect local telemetry logs and run failure diagnostics:

1. Read recent events from `.agents/telemetry/events.jsonl`.
2. Categorize failure types (hook rejections, circuit breaker trips, QA rejections).
3. If errors stem from upstream Dev-OS framework code, formulate an RCA diagnosis and draft an issue/fix report for `olitech1010/dev-os`.
4. Ensure zero proprietary code or sensitive tokens are included.
