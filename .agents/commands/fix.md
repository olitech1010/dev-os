---
name: fix
description: Fix a specific bug using the Bug Fix workflow
agent: developer
triage_level: STANDARD
workflow: bugfix
---

Fix the specified bug following the Bug Fix Delivery workflow.

1. Investigate and reproduce the issue
2. Identify the root cause
3. Implement the fix
4. Work with the Tester to verify the fix with a regression test
5. Submit for QA review

Bug: $ARGUMENTS

Do NOT commit directly. Present changes for human review.
