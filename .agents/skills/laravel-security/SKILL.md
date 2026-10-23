---
name: laravel-security
description: "Use when building, configuring, or reviewing a Laravel application for security: authentication (Sanctum, Passport), authorization (gates, policies), Eloquent mass assignment and SQL injection, CSRF, XSS, input validation, API rate limiting and CORS, file uploads, secrets, queues, and production configuration."
metadata:
  source: https://github.com/affaan-m/everything-claude-code
  origin: ECC
license: MIT
---

# Laravel Security Best Practices

Comprehensive security guidelines for Laravel applications to protect against common vulnerabilities.

## When to Activate

- Setting up Laravel authentication and authorization (Sanctum, Passport, Jetstream, Breeze)
- Implementing user roles, permissions, and policies
- Configuring production security settings and environment variables
- Reviewing Laravel applications for security vulnerabilities
- Deploying Laravel applications to production
- Writing secure Eloquent queries and migrations

## Core Rules

- Production runs with `APP_DEBUG=false`, a generated `APP_KEY`, and HTTPS enforced; `.env` is never committed and secrets come from the environment or a secret manager.
- Authenticate APIs with Sanctum (or Passport for OAuth) using token abilities; hash passwords with the framework hasher; regenerate the session on login.
- Authorize every action with gates or policies, not ad-hoc checks in controllers.
- Whitelist `$fillable`; never `$guarded = []`. Use the query builder or bound parameters; never interpolate input into raw SQL.
- Keep CSRF protection on all state-changing web routes; escape output with `{{ }}` and sanitize any HTML rendered with `{!! !!}`.
- Validate all input with FormRequests and use `$request->validated()`, never `$request->all()`.
- Rate-limit auth and API endpoints, restrict CORS origins, and validate upload MIME type, size, and storage location.
- Run `composer audit` in CI and log security events (auth failures, role changes).

## References

Code samples live in these files. Read only the one matching the task:
- `references/config-and-auth.md`: production settings, `.env` handling, HTTPS enforcement, Sanctum tokens, password hashing, and session management. Read when configuring a deploy or building login and token flows.
- `references/authorization-and-eloquent.md`: gates, policies, middleware authorization, mass assignment, SQL injection, attribute casting, and model security. Read when adding roles or permissions or writing queries and models.
- `references/csrf-xss-validation.md`: CSRF defaults and exclusions, Blade escaping, safe HTML, JS context escaping, security headers, FormRequest validation, and custom rules. Read when building forms, templates, or request validation.
- `references/api-uploads-secrets-queues.md`: rate limiting, Sanctum vs Passport, CORS, file upload validation and storage, `composer audit`, secret management, queue payload safety, and security event logging. Read when exposing an API, accepting uploads, or hardening operations.

## Quick Security Checklist

| Check | Description |
|-------|-------------|
| `APP_DEBUG=false` | Never run with debug enabled in production |
| `APP_KEY` set | Always run `php artisan key:generate` |
| HTTPS enforced | Force HTTPS in production via middleware or proxy |
| `$fillable` whitelisted | Never use `$guarded = []` |
| CSRF active | `@csrf` on all state-changing forms |
| Sanctum/Passport configured | API authentication with token abilities/scopes |
| Rate limiting applied | Throttle API and auth endpoints |
| Input validation | FormRequest with specific rules, never `$request->all()` |
| File upload restrictions | Validate MIME types, size, dimensions |
| `composer audit` in CI | Check dependencies for known vulnerabilities |
| `password_hash` / `password_verify` | Use Laravel's built-in hashing (bcrypt/Argon2) |
| Session regeneration on login | Call `$request->session()->regenerate()` |
| Security headers middleware | CSP, X-Frame-Options, X-Content-Type-Options |
| Logged security events | Audit log for auth failures, role changes, suspicious activity |
| `.env` not committed | Verify `.gitignore` includes `.env` |

## Related Skills

- `laravel-specialist`: Laravel architecture, Eloquent, routing, and API patterns.
- `laravel-tdd`: Laravel testing with PHPUnit and Pest.
- `laravel-verification`: pre-deploy verification loop.
- `security-review`: stack-neutral vulnerability review.
- `backend-dev-guidelines`: general backend API and database patterns.
