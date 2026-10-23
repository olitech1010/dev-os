# <Feature name>: Design

Spec: docs/specs/<slug>/
Requirements: requirements.md (approved <date>)
Status: DRAFT | APPROVED (checkpoint 2, <date>, <approver>)

## Overview

Two or three sentences: the approach and why it was chosen over the alternatives below.

## Requirement Trace

| Requirement | Where the design handles it |
|---|---|
| R1 | <component or section> |
| R2 | <component or section> |

## Architecture

How the parts fit together. A small diagram is welcome when it shows the real flow.

## Components and Interfaces

### <Component>
- Responsibility: <one sentence>
- Interface: <function signatures, routes, events, or CLI flags, with verified library APIs>
- Covers: R1

## Data Model

Tables, fields, types, indexes, and row-level security. Mark every schema change for DBA review.

## Error Handling

| Failure | Detection | Response | Requirement |
|---|---|---|---|
| <failure> | <how it is noticed> | <what the user or caller sees> | R1 |

## Security and Privacy

Auth, input validation, secrets (`process.env.*` only), and rate limits. Mark items for Security review.

## Testing Strategy

- Unit: <what>
- Integration: <what>
- End to end or manual: <what>

## Alternatives Considered

- <option>: rejected because <reason>

## Risks and Rollback

- <risk>: <mitigation or how to revert>
