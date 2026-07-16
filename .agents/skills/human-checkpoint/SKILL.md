---
name: human-checkpoint
description: Protocols for communicating with the human and gating actions.
---

# Human Checkpoint

A human checkpoint is a hard stop. You may not proceed until explicit approval is given.

## When to Trigger
- Before ANY `git commit` or `git push`
- Before deploying to production
- Before executing irreversible infrastructure changes (e.g., dropping a DB table)
- When architectural requirements (PROJECT_REQUIREMENTS.md) are finalized

## How to Ask
Format your request clearly:
> **HUMAN CHECKPOINT REQUIRED**
> Reason: [Why you are stopping]
> Summary: [What has been done / what is about to happen]
> Do I have your approval to proceed? (Yes/No)
