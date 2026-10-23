# <Feature name>: Tasks

Spec: docs/specs/<slug>/
Design: design.md (approved <date>)
Status: DRAFT | APPROVED (checkpoint 3, <date>, <approver>)

## Format

`devos spec waves <slug>` and `devos spec check <slug>` parse this file. Follow the grammar exactly:

```
### T<n>: <title>
- depends: none | T<a>, T<b>, ...
- covers: R<x>, R<y>, ...
- verify: <command or check>
```

- **Task heading.** A line that is exactly `###`, one space, the id, a colon, one space, and a non-empty title. Ids are `T` followed by a positive integer with no leading zero. Ids are unique in the file.
- **Task block.** It runs from the heading to the next `##` or `###` heading, or to the end of the file.
- **Fields.** Each block holds exactly one line of each field: a dash, one space, the lowercase key, a colon, one space, and the value. Fields may appear in any order and may be mixed with free-text lines, which are ignored.
- **`depends:`** Either the word `none` or a comma-separated list of task ids from this file. Spaces after commas are optional. A task cannot depend on itself, and the dependency graph must have no cycles.
- **`covers:`** A comma-separated list of one or more requirement ids that exist as `### R<n>:` headings in `requirements.md`. Every requirement must be covered by at least one task.
- **`verify:`** A non-empty command or check that proves the task is done (for example `npm test -- reset.test.ts`).
- **Ignored lines.** Lines inside fenced code blocks (like the grammar above) are ignored. Trailing whitespace and CRLF line endings are tolerated.

Tasks in the same wave (same depth in the dependency graph) can run in parallel.

## Tasks

### T1: <data layer change>
Create the migration and model for <entity>. Needs DBA review.
- depends: none
- covers: R1
- verify: npm test -- <entity>.model.test.ts

### T2: <service or API change>
Add <endpoint or function> on top of T1.
- depends: T1
- covers: R1, R2
- verify: npm test -- <service>.test.ts

### T3: <UI or caller change>
Wire the screen or caller to T2. Needs an approved DESIGN.md.
- depends: T2
- covers: R2
- verify: npm run test:e2e -- <flow>.spec.ts
