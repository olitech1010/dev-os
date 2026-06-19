# Using the Agent System

This folder contains the system prompts and orchestration protocols for the Olives Technologies multi-agent engineering team.

---

## Quick Start

### If you're using Claude Code

1. Copy the relevant agent prompt from `agents/prompts/` into your project context
2. Copy the universal `skills/CLAUDE.md` + your stack's `stacks/<stack>/CLAUDE.md` into your project root as `CLAUDE.md`
3. Start Claude Code — it reads `CLAUDE.md` automatically

### If you're using Cursor

1. Copy `skills/cursor.md` content into `.cursor/rules` in your project
2. Append your stack's `stacks/<stack>/cursor.rules` content below it
3. Reference agent prompts in your composer sessions as needed

### If you're building a custom agent pipeline (LangGraph, AutoGen, etc.)

1. Load each agent's system prompt from `agents/prompts/<agent>.md`
2. Use `agents/AGENTS.md` to understand the orchestration protocol
3. Use `agents/orchestrator/orchestrator.md` as your coordinator agent

---

## How to Activate an Agent

In Claude Code or Cursor, start a session with:

```
You are acting as the [Architect / Researcher / Developer / Reviewer / etc.] agent.
Load your role definition from agents/prompts/[agent].md.
Current task: [describe the task]
```

Or simply paste the contents of the relevant prompt file as your system prompt.

### Starting a New Project (Grill-Me Inception)

When starting a brand new project, activate the Architect agent first:

```
You are acting as the Architect agent.
Load your role definition from agents/prompts/architect.md.
Load the grill-me skill from skills/grill-me.md.
Here is the initial project brief:

[paste your rough project idea here]
```

The Architect will produce a `PROJECT_REQUIREMENTS.md` for your review before any code is written.

---

## The Agent Loop in Practice

For a typical feature:

```bash
# 1. Tell the Orchestrator what you want
"Add email verification to the registration flow"

# 2. Orchestrator breaks it down — you see the plan

# 3. Researcher confirms: does Supabase Auth support email OTP? 
#    What's the correct API? Any known issues?

# 4. Developer implements — following CLAUDE.md and CODING_STANDARDS.md

# 5. Reviewer checks — returns APPROVED or CHANGES REQUESTED

# 6. Tester writes and runs tests

# 7. Security scans the auth flow

# 8. DevOps prepares the deployment plan

# 9. You review the plan and say "confirmed, proceed"

# 10. Done
```

---

## Prompting Tips

**Be specific with the Orchestrator:**
```
✅ "Add a password reset flow using Supabase Auth magic links. 
    The reset email should use our transactional email template.
    Users should be redirected to /dashboard after reset."

❌ "Add password reset"
```

**Give Researcher a specific question:**
```
✅ "Is Supabase Auth's magic link compatible with Next.js 14 middleware? 
    Specifically, can we check session validity in middleware.ts?"

❌ "Look into Supabase auth"
```

**Give Developer complete context:**
```
✅ "Implement the forgot-password page at app/(auth)/forgot-password/page.tsx.
    Use the Server Action pattern. Validate with Zod. 
    Success state shows a confirmation message, not a redirect.
    Error state should not reveal whether the email exists (security)."

❌ "Build the forgot password page"
```

---

## Adapting for Your Project

The agent prompts are starting points, not fixed rules. You should:

1. Add project-specific constraints to each agent's prompt (e.g. "this project uses Prisma, not Supabase")
2. Add domain-specific security checks to the Security agent (e.g. specific compliance requirements)
3. Adjust the Reviewer's checklist to match your team's standards

---

## Folder Structure

```
agents/
├── README.md                    ← This file
├── AGENTS.md                    ← Roster, roles, and workflow protocols
├── orchestrator/
│   └── orchestrator.md          ← Orchestrator system prompt
└── prompts/
    ├── architect.md             ← Architect / grill-me inception agent
    ├── developer.md             ← Developer agent
    ├── researcher.md            ← Researcher agent
    ├── reviewer.md              ← Reviewer / code review agent
    ├── tester.md                ← Tester / QA agent
    ├── devops.md                ← DevOps / deployment agent
    └── security.md              ← Security scan agent
```
