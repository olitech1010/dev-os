---
name: test
description: Write and run tests for specified code
agent: tester
triage_level: STANDARD
workflow: direct
---

Write and execute tests for the specified target.

1. Read the target code to understand its behavior
2. Write tests covering: happy path, edge cases, and failure states
3. Run the test suite and report results
4. If tests fail, report failures to the Developer — do NOT fix the code yourself

Target: $ARGUMENTS
