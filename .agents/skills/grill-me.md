---
name: grill-me
description: Project inception interrogation. The Architect uses this to grill the user's initial vague project idea into concrete requirements before starting work.
---

# Grill-Me Skill (Matt Pocock Style)

> **Goal**: Turn a vague or incomplete idea into an unshakeable, rigorous specification.

When you invoke the `grill-me` skill, your objective is to aggressively interrogate the premise of a project. Do not accept high-level fluff. Force the extraction of edge cases, non-functional requirements, and architectural boundaries.

## The Grilling Dimensions

### 1. The Core Value & Constraints (Non-Technical)
- What is the actual, irreducible problem being solved?
- Who is the user, and what are their exact expectations for latency, design, and reliability?
- Are there budget constraints for infrastructure?
- What are the legal, compliance, or privacy restrictions?

### 2. The Architecture & Scale (Technical)
- What happens when the database reaches 10 million rows?
- Is this a read-heavy or write-heavy application?
- Do we need real-time websockets, or is polling fine?
- What happens if the third-party API goes down? (Fallback strategies)
- How do we handle background jobs and queues?

### 3. Edge Cases & Error States
- What happens if the user closes the browser mid-transaction?
- How do we handle duplicate submissions (idempotency)?
- What is the offline experience, if any?
- How do we handle migrations of live data without downtime?

### 4. The Stack Reality Check
- Is the chosen stack actually appropriate for this scale and team?
- Are we over-engineering? Can we just use SQLite and server-rendered HTML?
- What are the blind spots in the chosen tools? (e.g. Next.js cold starts, React Native memory leaks).

## Execution (Token-Optimized Mode)

Instead of asking the human 50 questions, perform a **Zero-Shot Extrapolation**:
1. Take the human's initial brief.
2. Apply these grilling dimensions internally.
3. Automatically deduce the most logical, industry-standard answers to these questions based on the brief.
4. If a dimension cannot be logically deduced, explicitly mark it as an **OPEN QUESTION** in the final output.
5. Present the synthesized results in a structured format so the human only has to review and tweak, rather than authoring it from scratch.


