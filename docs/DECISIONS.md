# Architecture Decision Records (ADRs)

An ADR is a short document that captures a significant architectural decision — what was decided, why, and what alternatives were considered.

Writing ADRs takes 10 minutes. Not writing them costs hours of "why is this like this?" six months later.

---

## When to Write an ADR

Write one when you're deciding:
- Which database, framework, or major library to use
- How authentication and authorisation will work
- The overall data model structure
- How the system handles a cross-cutting concern (logging, error handling, caching)
- Any decision that, if changed later, would require significant rework

Small decisions (which utility function to use, naming of a variable) do not need ADRs.

---

## ADR Template

Copy this for each new decision. Save as `docs/decisions/ADR-###-short-title.md`.

```markdown
# ADR-001: [Title — the decision made, not the question asked]

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-###
**Deciders:** [Who was involved in making this decision]

## Context

[2-4 sentences. What situation forced this decision? What constraints existed?
What were we trying to achieve? Write it so someone who wasn't there understands
the pressures that led to this choice.]

## Decision

[1-3 sentences. What did we decide to do? Be specific.
"We will use X for Y" not "We considered using X".]

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Option A | ... | ... | ... |
| Option B | ... | ... | ... |
| [Chosen option] | ... | ... | [Not rejected — chosen because...] |

## Consequences

**Positive:**
- [What this decision enables or makes easier]

**Negative / Trade-offs:**
- [What this decision makes harder or forecloses]

**Risks:**
- [What could go wrong, and how serious it would be]

## Implementation Notes

[Optional: Any specific notes on how to implement this correctly.
Links to relevant docs, known gotchas, etc.]
```

---

## Example ADR

```markdown
# ADR-001: Use Supabase for database and authentication

**Date:** 2026-06-01
**Status:** Accepted
**Deciders:** Olives

## Context

SafeVoice needs a database and authentication system that can be stood up quickly,
supports row-level security at the database level (critical for multi-tenant
case data privacy), and can be self-hosted in the future if required by NGO data
sovereignty policies.

## Decision

We will use Supabase (PostgreSQL + Supabase Auth + RLS) for both the database
and authentication layer.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Firebase | Fast setup, real-time built-in | No SQL, vendor lock-in, weak RLS | Data model is relational; RLS is non-negotiable |
| PlanetScale + NextAuth | Scalable MySQL, flexible auth | No built-in RLS, more moving parts | More infrastructure to manage |
| Supabase | PostgreSQL, RLS native, self-hostable | Less mature than Firebase | Chosen — best fit for requirements |

## Consequences

**Positive:**
- Row-level security enforced at DB level — even a compromised app layer can't leak data
- Single service for auth + database reduces operational complexity
- Can self-host on a VPS if NGO data sovereignty requirements change
- pgvector available for future AI/search features

**Negative:**
- Supabase's local development setup is heavier than Firebase emulator
- Supabase is less mature — some features are still in beta

**Risks:**
- Supabase is a startup — if they shut down, we need to migrate. Mitigation: use standard PostgreSQL features and avoid Supabase-specific extensions where possible.
```

---

## ADR Index

Keep this table updated as decisions accumulate:

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| 001 | [Your first decision] | Accepted | YYYY-MM-DD |
| 002 | [Your second decision] | Accepted | YYYY-MM-DD |

---

## Superseding an ADR

When a decision changes, don't delete the old ADR. Mark it as superseded:

```markdown
**Status:** Superseded by ADR-007

## Why This Was Superseded
[Brief explanation of what changed that made the old decision wrong or suboptimal]
```

The history of decisions — including the ones that turned out to be wrong — is valuable.
