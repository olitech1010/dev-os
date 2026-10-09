---
name: telemetry
description: Inspect local telemetry events, analyze failures, or generate RCA feedback report
agent: telemetry
triage_level: TRIVIAL
workflow: direct
---

Inspect local telemetry logs and run failure diagnostics:

1. Read recent events from `.agents/telemetry/events.jsonl`:
   ```bash
   devos telemetry status
   devos telemetry report
   devos telemetry report --json
   ```
2. Categorize failure types (framework bugs, gate violations, circuit breaker loops).
3. If errors stem from upstream Dev-OS framework code, formulate an RCA diagnosis and synthesize a sanitized upstream issue or pull request:
   ```bash
   devos telemetry issue --dry-run
   devos telemetry pr --dry-run
   devos telemetry export
   ```
4. Strict Sanitization Gate: Ensure zero proprietary code, credentials, machine paths, or sensitive tokens are included.
