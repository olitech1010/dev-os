---
name: eval
description: Run capability benchmarks, measure pass@k reliability, and generate agent scorecards
agent: eval-engineer
triage_level: STANDARD
workflow: direct
---

Execute Dev-OS capability benchmarks, reliability evaluations, and agent scorecards:

1. Run evaluation suites via `node scripts/eval-runner.js` or `devos eval run`.
2. Measure pass@k rates (pass@1, pass@3, pass@5) across agent workflows.
3. Validate that the 5-layer quality gates, multi-harness parity, and memory preservation do not regress.
4. Generate structured scorecards in `.agents/evals/reports/` and issue formal `EVAL_PASSED` or `EVAL_REGRESSED` verdicts.
5. If regressions are detected, provide exact file locations and remediation steps.
