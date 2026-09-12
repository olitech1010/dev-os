---
name: telemetry
description: |
  Observability, local failure logging, and automated RCA reporting for Dev-OS.
  Maintains .agents/telemetry/events.jsonl, enforces strict zero-secret sanitization,
  and synthesizes actionable diagnostic reports and pull requests to olitech1010/dev-os.
license: MIT
metadata:
  version: "1.0.0"
  default_state: "on"
  log_path: ".agents/telemetry/events.jsonl"
---

# Dev-OS Telemetry & Root Cause Analysis (RCA) Protocol

Dev-OS includes a privacy-preserving telemetry and diagnostic engine. By default, telemetry is enabled (`telemetry: on (recommended)`) to capture execution errors, circuit-breaker trips, and hook failures locally.

---

## 1. Privacy First Architecture

Telemetry data is buffered locally on the developer's machine:
- **Location:** `.agents/telemetry/events.jsonl`
- **Sanitization Rule:** NEVER store or transmit:
  - Proprietary business code or repository source files
  - API keys, credentials, tokens, or `.env` content
  - Personally identifiable information (PII)
- **Data Captured:**
  - Event type (e.g. `HOOK_FAILURE`, `CIRCUIT_BREAKER_TRIP`, `QA_REJECTION`)
  - Tool name and exit code
  - Sanitized error message (secrets masked)
  - Target AI harness (Claude, Antigravity, Cursor, OpenCode, Codex)
  - Node version and Dev-OS version
  - ISO timestamp

---

## 2. Event Format

Each log entry in `.agents/telemetry/events.jsonl` follows this JSON structure:

```json
{
  "timestamp": "2026-09-12T18:00:00.000Z",
  "version": "4.0.0",
  "harness": "antigravity",
  "eventType": "CIRCUIT_BREAKER_TRIP",
  "details": {
    "role": "developer",
    "loopCount": 3,
    "issueCategory": "type_check_failure",
    "sanitizedMessage": "Property 'id' does not exist on type 'User'"
  }
}
```

---

## 3. Telemetry Agent Responsibilities

The **Telemetry Agent** (`.agents/agents/telemetry.md`):
1. Reads `.agents/telemetry/events.jsonl` during diagnostic sessions (`devos doctor` or `devos telemetry report`).
2. Synthesizes an RCA report categorizing failure patterns.
3. If an upstream Dev-OS bug is identified (e.g., regex edge case in a hook, outdated command syntax), drafts an actionable fix for submission to `https://github.com/olitech1010/dev-os`.

---

## 4. Configuration & Opt-Out

Users can check or modify telemetry preferences at any time:
```bash
# Check telemetry status
devos telemetry status

# Disable telemetry
devos telemetry disable

# Re-enable telemetry
devos telemetry enable
```
Or set `telemetry: "off"` in `.agents/manifest.json`.
