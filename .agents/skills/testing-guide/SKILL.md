---
name: testing-guide
description: |
  Protocol for authoring comprehensive, step-by-step interactive testing guides in docs/TESTING_GUIDE.md.
  Ensures human testers, non-technical startup founders, and QA reviewers have complete walkthroughs,
  functional test scenarios, realistic seed data, and standard dev test accounts with universal passwords (devos123).
license: MIT
metadata:
  version: "1.0.0"
  target_file: "docs/TESTING_GUIDE.md"
  universal_password: "devos123"
---

# Interactive Testing Guide Protocol

Whenever delivering an MVP, a feature set, or concluding autonomous development mode (`auto` / `devos run`), the Tester and QA agents MUST author or update:

**`docs/TESTING_GUIDE.md`**

This document serves as the single source of truth for non-technical startup founders, product managers, and human QA testers to test every feature end-to-end without guessing.

---

## 1. Core Principles

1. **Zero Guesswork:** Every screen, button, input field, and expected output must be documented with explicit click-by-click instructions.
2. **Universal Test Passwords (`devos123`):**
   - In all local environments, seed fixtures, mock accounts, and test scenarios, the password for ALL test users is strictly:
     ```
     devos123
     ```
   - This eliminates authentication friction for human testers and prevents forgotten credential blockers.
3. **Realistic Seed Data:** Document the exact sample entities available in the database (e.g. users, items, transactions, orders) so testers know which records exist.
4. **Interactive Checkboxes:** Format testing flows as interactive Markdown checklists (`- [ ]`) so human testers can track their progress directly.

---

## 2. Standard Test User Personas

Every application with authentication must provide seed accounts matching these standard personas:

| Role | Email / Username | Password | Purpose |
|---|---|---|---|
| **Admin User** | `admin@example.com` | `devos123` | Testing administration, user management, and privileged controls |
| **Standard User** | `user@example.com` | `devos123` | Testing normal day-to-day user flows and CRUD operations |
| **Secondary User** | `member@example.com` | `devos123` | Testing multi-user interactions, sharing, comments, and permissions |
| **Restricted / Unverified** | `guest@example.com` | `devos123` | Testing access boundaries, paywalls, and unverified state restrictions |

---

## 3. Structure of `docs/TESTING_GUIDE.md`

Every `docs/TESTING_GUIDE.md` must follow this structure:

```markdown
# Application Testing & QA Guide

**Application:** [Project Name]
**Environment:** Local Development (`http://localhost:3000` or local port)
**Target Audience:** Human QA Testers, Product Owners, Startup Founders
**Default Credentials Password:** `devos123` (Universal across all seed accounts)

---

## 1. Quick Start & Prerequisites
- Commands to start backend and frontend services (e.g. `npm run dev`)
- Command to seed the database (e.g. `npm run seed` or `db:seed`)
- Local URL to open in browser

## 2. Seed Data Fixtures
- Summary of pre-populated records available for testing
- IDs, names, and attributes of sample data

## 3. Test Scenarios (Step-by-Step Walkthroughs)

### Scenario A: Authentication & Role Verification
- [ ] 1. Navigate to `/login`.
- [ ] 2. Enter `user@example.com` and password `devos123`. Click "Sign In".
- [ ] 3. Verify redirection to `/dashboard` and that user profile displays "Standard User".
- [ ] 4. Log out. Log in as `admin@example.com` (`devos123`) and verify access to `/admin`.

### Scenario B: Core Feature Flow
- [ ] 1. Action step 1...
- [ ] 2. Action step 2...
- [ ] 3. Expected visual result / state change...

### Scenario C: Edge Cases & Boundary Handling
- [ ] 1. Empty input validation...
- [ ] 2. Duplicate submission error message...
- [ ] 3. Permission denial when accessing restricted endpoints...

## 4. Known Limitations & Notes
- List any mock third-party integrations (e.g. Stripe test mode, email trap)
- Non-blocking known UI details
```

---

## 4. Generation & Verification Checklist

Before marking any delivery complete:
- [ ] `docs/TESTING_GUIDE.md` exists and is linked in `docs/CURRENT_STATE.md`.
- [ ] All test accounts listed use the password `devos123`.
- [ ] All links and paths are valid and tested.
- [ ] The document has passed the Humanizer check (`.agents/scripts/humanize-check.sh`).
