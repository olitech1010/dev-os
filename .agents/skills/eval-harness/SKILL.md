---
name: eval-harness
description: |
  Quantitative reliability evaluation, capability benchmarking, pass@k metrics, and regression testing for Dev-OS.
  Provides structured test suites (.agents/evals/suites/), automated runner (scripts/eval-runner.js),
  and scorecards (.agents/evals/reports/) for the Eval Engineer agent.
license: MIT
metadata:
  version: "1.0.0"
  runner: "scripts/eval-runner.js"
  suites_dir: ".agents/evals/suites"
  reports_dir: ".agents/evals/reports"
---

# Dev-OS Evaluation & Reliability Harness Protocol

This document defines the quantitative evaluation framework for measuring agent capability, workflow reliability, quality gate adherence, and cross-harness parity. Maintained by the **Eval Engineer** agent.

---

## 1. Core Principles

1. **Quantifiable Over Impressionistic:** Never judge agent reliability by a single casual prompt run. Measure empirical pass rates and $pass@k$ curves across standardized scenarios.
2. **Regression Prevention:** Every major architectural upgrade or hook modification must pass the benchmark suite before release.
3. **Multi-Harness Parity:** Ensure equal rigor across all supported environments (Claude Code, Google Antigravity, Gemini, Cursor, OpenCode, Codex).
4. **Zero-Dependency Execution:** The evaluation runner executes in pure Node.js without third-party npm packages.

---

## 2. Evaluation Suite Catalog

Suites are defined in `.agents/evals/suites/*.eval.json`:

| Suite ID | Category | Scope | Key Assertions |
|---|---|---|---|
| `gates` | Safety | 5-Layer Quality Gate Architecture | Design Gate, Gitleaks, UI Taste Check, Humanizer Check, Env Parity, DB RLS, Commit Gate |
| `harness-parity` | Compatibility | Multi-Platform AI Harness Parity | Claude, Antigravity, Cursor, OpenCode, and Codex config parity & Hard Rules digest |
| `memory-preservation` | State | Shared Memory Vault & State Governance | `context.json`, `docs/TASK_BOARD.md` DAG, `docs/CURRENT_STATE.md`, ADRs & handoffs |
| `agent-authority` | Governance | Role Boundaries & Specialization | Orchestrator, Developer, QA, Tester, DBA, Security authority constraints |
| `workflow-integrity` | Workflow | Autonomous SDLC Lifecycle | Standard Feature Delivery, Circuit Breaker (3 loops), Solo Session Protocol, `devos123` password |

---

## 3. Mathematical pass@k Metric

The evaluation runner computes $pass@k$ based on the probability of generating at least one correct result in $k$ independent samples:

$$pass@k = 1 - \frac{\binom{n-c}{k}}{\binom{n}{k}}$$

Where:
- $n$: Total sampling trials executed per case (configured via `--k <number>`)
- $c$: Successful executions ($c \le n$)
- $k$: Evaluated thresholds ($k \in [1, 3, 5]$)

---

## 4. CLI Commands

```bash
# Run all evaluation suites
devos eval run

# Run with 3 sampling trials for empirical pass@k
devos eval run --k 3

# Run a specific suite
devos eval run --suite gates

# List available suites and test cases
devos eval list

# Display the latest evaluation scorecard
devos eval scorecard

# Output scorecard as JSON (for CI/CD gating)
devos eval run --json
```

---

## 5. Verdict Thresholds

The Eval Engineer issues formal verdicts based on objective criteria:

- **`EVAL_PASSED`**:
  - Overall Reliability Index $\ge 95\%$
  - Zero critical gate or security regressions
- **`EVAL_REGRESSED`**:
  - Overall Reliability Index $< 95\%$, OR
  - Any critical safety gate failure (Design Gate, Secret Scanner, DB RLS, Commit Gate)
