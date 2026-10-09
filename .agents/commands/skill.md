---
name: skill
description: Synchronize, audit, or discover agent skills from the ecosystem
agent: devops
triage_level: TRIVIAL
workflow: direct
---

Manage, audit, and synchronize specialist agent skills:

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
