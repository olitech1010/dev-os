# <Feature name>: Requirements

Spec: docs/specs/<slug>/
Status: DRAFT | APPROVED (checkpoint 1, <date>, <approver>)

## Format

`devos spec check` and `devos spec waves` read this file. Keep these rules:

- Each requirement starts with a level-3 heading: `###`, one space, the id, a colon, one space, the title. Ids are `R` followed by a positive integer with no leading zero (`R1`, `R2`, ... `R12`).
- Ids are unique in the file. Gaps are allowed; never renumber an approved id, because tasks and design sections cite it.
- A requirement's body runs until the next `##` or `###` heading.
- Lines inside fenced code blocks are ignored, so examples like the one below are never read as requirements.

```
### R1: Reset link by email
```

## Glossary

- **<Term>**: <meaning in this feature>

## Requirements

### R1: <short title>

**User story:** As a <role>, I want <capability>, so that <benefit>.

Acceptance criteria:

1. WHEN <trigger> THE SYSTEM SHALL <observable response>.
2. IF <unwanted condition> THEN THE SYSTEM SHALL <safe response>.

### R2: <short title>

**User story:** As a <role>, I want <capability>, so that <benefit>.

Acceptance criteria:

1. WHILE <state holds> THE SYSTEM SHALL <ongoing behaviour>.
2. WHERE <optional feature is enabled> THE SYSTEM SHALL <behaviour>.

## Out of Scope

- <what this feature deliberately does not do>

## Open Questions

- <question for the human; resolve before checkpoint 1>
