---
name: skill
description: Synchronize, audit, or discover agent skills from the ecosystem
agent: devops
triage_level: TRIVIAL
workflow: direct
argument-hint: "[audit|list|sync|check|find <query>|add <owner/repo>]"
---

Manage, audit, and synchronize specialist agent skills.

Requested action: $ARGUMENTS (default: `audit`)


1. **Audit skills against Agent Skills Standard & token budgets:**
   ```bash
   devos skill audit
   devos skill audit --json
   ```
2. **List installed skills with token weight estimates:**
   ```bash
   devos skill list
   devos skill list --json
   ```
3. **Diff-aware synchronization & customization safety backup:**
   ```bash
   devos skill sync --dry-run
   devos skill sync
   ```
4. **Check for upstream updates & local modifications:**
   ```bash
   devos skill check
   devos skill check --json
   ```
5. **Discover & install skills from skills.sh:**
   ```bash
   devos skill find <query>
   devos skill add <owner/repo>
   ```

`devos skill add`, `devos skill sync`, and `devos skill update` change installed skills and may download third-party content. Show the human the exact command and source and get explicit approval before running them. Run `devos skill sync --dry-run` before any sync.
