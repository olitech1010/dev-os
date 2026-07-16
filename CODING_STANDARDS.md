> Customize this file for your project. This template provides universal standards; add stack-specific rules from .agents/skills/stacks/

# Coding Standards

## General Principles
- Self-documenting code: Strive to write code that explains itself through clear naming.
- Single Responsibility Principle (SRP): Each module, class, or function should have one responsibility.
- Max 50-line functions: Break down large functions to improve readability.
- Max 3 nesting levels: Avoid deep nesting to reduce cognitive load.
- No commented-out code: Delete unused code; version control tracks history.
- No orphan TODOs: Every TODO must reference an issue or ticket.

## Type Safety
- TypeScript strict mode: Enable strict mode in TypeScript configurations.
- No ts-ignore without reason: Always provide a justification comment if ts-ignore must be used.
- Prefer inference: Rely on type inference where it is clear instead of explicitly typing everything.

## Error Handling
- Never swallow exceptions: Always log or handle exceptions.
- Handle at boundary: Catch errors at application boundaries (e.g. controllers, UI components).
- Typed errors: Use custom error classes or typed errors.
- Contextual logging: Include relevant context in error logs.

## Security
- No hardcoded secrets: Use environment variables or secret managers.
- Environment variables: Use .env files for local development and proper CI/CD injection for production.
- Input validation: Validate all incoming data from users or external APIs.
- Sanitization: Sanitize inputs to prevent XSS and other injection attacks.
- Parameterized queries: Always use parameterized queries or ORMs to prevent SQL injection.

## File Organization
- Group by feature: Organize files by feature or domain rather than technical role.
- Co-locate tests: Place test files next to the implementation files (e.g. feature.ts and feature.test.ts).
- Organized imports: Group imports logically (external libraries, internal modules, types).

## Naming Conventions
- camelCase variables: variables, functions, and methods.
- PascalCase components: Classes and UI Components.
- SCREAMING_SNAKE constants: Global constants and configuration values.
- kebab-case files: File and directory names.
- snake_case database: Database tables and columns.

## Testing Requirements
- 80% coverage on new logic: Aim for high test coverage on all new features.
- Test behavior not implementation: Write tests that verify the outcome, not internal workings.
- Descriptive names: Test names should clearly state what is being tested and the expected outcome.

## Git Standards
- Follow standard Git practices: Reference `.agents/skills/git-ops/SKILL.md` and `.agents/skills/git-workflow/SKILL.md`.
