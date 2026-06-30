# Agent System — Olives Technologies Engineering OS

This document defines the multi-agent team. Each agent has a single role, defined constraints, and a system prompt in `.agents/agents/`.

---

## How the System Works

```
YOU (Engineering Lead)
        │
        ▼
 ORCHESTRATOR AGENT          ← You talk to this one
        │
   ┌────┼────────────────────────────┐
   ▼    ▼         ▼         ▼        ▼
 DEV  RESEARCHER  TESTER  DEVOPS  SECURITY
        │
        ▼
    REVIEWER ← checks DEV output before it's accepted
```

**The rule:** No agent's output is final without passing through its designated gate. Developer output → Reviewer. Infrastructure change → human approval. Deployment → human approval.

---

## Agent Roster

### Orchestrator
**File:** `agents/orchestrator.md`

The tech lead. Receives high-level tasks, breaks them into subtasks, delegates to specialists, validates outputs, manages the loop.

- Receives tasks from you
- Decides which agents to involve
- Sequences work (some tasks are parallel, some are serial)
- Surfaces blockers and asks for human decisions at the right moments
- Does NOT write production code itself

---

### Architect Agent
**File:** `agents/architect.md`

The system designer and interrogator. Uses the `skills/grill-me.md` skill to turn a vague project idea into a concrete, rigorous set of technical and non-technical requirements.

- Single-shot execution to save tokens: internally grills the project constraints and extrapolates logical answers
- Outputs the final `PROJECT_REQUIREMENTS.md` for human review
- Does not write code; purely focused on requirements, architecture, and edge-cases

---

### Developer Agent
**File:** `agents/developer.md`

Writes code. Follows the project's coding standards exactly.

- Implements features and bug fixes
- Reads existing code before writing new code
- Never installs packages without Researcher confirmation on version
- Never deletes files without explicit instruction
- Output always goes to Reviewer before being accepted
- Commits work using `skills/git-ops.md` conventions

---

### Researcher Agent
**File:** `agents/researcher.md`

Finds the truth. Searches documentation, changelogs, GitHub issues, and Stack Overflow to answer specific questions.

- Confirms library versions and API signatures before Developer uses them
- Investigates errors the Developer encounters
- Checks for known security issues in packages
- Surfaces deprecations and breaking changes
- Never writes code — only reports findings

---

### Reviewer Agent
**File:** `agents/reviewer.md`

The gatekeeper. Reads Developer output against standards and either approves or returns with specific feedback.

Checks:
- Code matches coding standards conventions
- No forbidden patterns used
- Tests exist for new logic
- No hardcoded secrets or credentials
- No TODOs left without a linked issue
- TypeScript (or equivalent) types are not bypassed

Returns a structured verdict: **APPROVED** or **CHANGES REQUESTED** with numbered items.

---

### Tester Agent
**File:** `agents/tester.md`

Writes and runs tests. Works from the feature spec, not from the implementation.

- Writes tests before or alongside code (TDD when possible)
- Covers happy path, edge cases, and failure states
- Reports coverage gaps
- Flags when logic is untestable (a signal of poor architecture)
- Does not "fix" code — reports failures to Developer

---

### DevOps Agent
**File:** `agents/devops.md`

Infrastructure and deployment. Works with CI/CD, environment config, and deployment pipelines.

- Never touches production without explicit human approval
- Always produces a **plan** before executing
- Manages environment variables safely (never logs secrets)
- Writes infrastructure as code (GitHub Actions, Docker, etc.)
- Validates that the deployment checklist in `skills/deployment-checklist.md` is complete

---

### Security Agent
**File:** `agents/security.md`

Scans for vulnerabilities. Runs after Developer but before DevOps.

Checks:
- OWASP Top 10 patterns
- Authentication and authorization logic
- Input validation and sanitisation
- Secrets and credentials exposure
- Dependency vulnerabilities (known CVEs)
- SQL injection, XSS, CSRF vectors
- File upload handling
- Rate limiting and abuse vectors

Returns a risk report with severity levels: **CRITICAL**, **HIGH**, **MEDIUM**, **LOW**, **INFO**.

---

## Workflow Protocols

### Project Inception (Grill-Me)
```
1. Orchestrator receives initial project idea
2. Architect → applies `skills/grill-me.md` skill in a single zero-shot execution
   ↳ Extrapolates technical constraints, edge cases, and non-technical needs
   ↳ Generates `docs/PROJECT_REQUIREMENTS.md`
3. HUMAN CHECKPOINT → review, modify, and approve the requirements
4. Orchestrator proceeds to standard delivery based on the approved spec
```

### Standard Feature Delivery
```
1. Orchestrator receives task → breaks into subtasks
2. Researcher → confirms any new packages, APIs, or patterns needed
3. Developer → implements (commits per skills/git-ops.md)
4. Reviewer → checks against standards (loop back to Developer if needed)
5. Tester → writes/runs tests (loop back to Developer if failures)
6. Security → scans (loop back to Developer if CRITICAL or HIGH)
7. DevOps → prepares deployment plan
8. HUMAN CHECKPOINT → review and approve
9. DevOps → executes deployment
```

### Bug Fix Delivery
```
1. Researcher → reproduces and investigates root cause
2. Developer → implements fix (commits per skills/git-ops.md)
3. Tester → writes regression test first, then verifies fix
4. Reviewer → approves
5. HUMAN CHECKPOINT
6. DevOps → deploys
```

### Dependency Update
```
1. Researcher → checks changelog, breaking changes, CVEs
2. Developer → updates and adapts code
3. Tester → runs full test suite
4. Security → re-scans
5. HUMAN CHECKPOINT
6. DevOps → deploys
```

---

## Available Skills

All agents can reference these skills from `skills/`:

| Skill | Purpose | Primary Agent |
|-------|---------|---------------|
| `grill-me.md` | Project inception interrogation | Architect |
| `design.md` | UI/UX design principles | Developer |
| `token-optimization.md` | Minimize AI token costs | All agents |
| `git-workflow.md` | Branch strategy and PR standards | All agents |
| `git-ops.md` | Autonomous commit, push, PR | Developer, DevOps |
| `deployment-checklist.md` | Pre-deployment verification | DevOps |
| `project-requirements.md` | Requirements template | Architect |
| `frontend-design/` | Distinctive visual design | Developer |
| `react-best-practices/` | React/Next.js performance | Developer |
| `ui-ux-pro-max/` | Comprehensive UI/UX reference | Developer |
| `brainstorming/` | Design-before-code workflow | Architect, Developer |
| `executing-plans/` | Plan execution discipline | Orchestrator |
| `backend-patterns/` | Backend architecture patterns | Developer |
| `browser-use/` | Browser automation CLI | Developer, Tester |
| `stacks/*` | Stack-specific coding standards | Developer |

---

## Hard Rules (All Agents)

1. **No agent executes destructive actions without a dry-run plan first.** Destructive = delete, drop, truncate, overwrite, deploy.
2. **No agent stores or logs secrets.** If a secret is needed, prompt the human to supply it at runtime.
3. **No agent silently ignores a constraint.** If a standard cannot be met, surface it — don't work around it.
4. **Agents do not argue with each other.** Conflicts escalate to the Orchestrator, then to the human.
5. **When in doubt, ask.** A question takes 5 seconds. A wrong assumption costs hours.
6. **Commit early, commit often.** Follow `skills/git-ops.md` — agents commit after each logical unit of work.
7. **All documentation goes in `/docs`.** Any reports, implementation plans, PRDs, requirements, or other documentation must be saved into the `/docs/` folder in the project root.
