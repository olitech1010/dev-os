---
name: laravel-tdd
description: "Use when writing or setting up tests for a Laravel application with PHPUnit or Pest: red-green-refactor TDD, model factories, model and feature/HTTP tests, JSON API and Sanctum auth tests, fakes for HTTP, mail, queues, storage, and events, Artisan command tests, authorization tests, and coverage thresholds."
metadata:
  source: https://github.com/affaan-m/everything-claude-code
  origin: ECC
license: MIT
---

# Laravel Testing with TDD

Test-driven development for Laravel applications using PHPUnit, Pest, Laravel factories, and testing helpers.

## When to Activate

- Writing new Laravel applications or features
- Implementing API endpoints with Sanctum or Passport authentication
- Testing Eloquent models, relationships, scopes, and accessors
- Setting up testing infrastructure for Laravel projects
- Writing feature tests for HTTP controllers and form requests
- Mocking external services (queues, mail, notifications, HTTP)

## TDD Workflow for Laravel

### Red-Green-Refactor Cycle

```php
// Step 1: RED — Write a failing test
public function test_a_product_can_be_created(): void
{
    $product = Product::factory()->create(['name' => 'Test Product']);
    $this->assertDatabaseHas('products', ['name' => 'Test Product']);
}

// Step 2: GREEN — Write the migration, model, and factory
// Step 3: REFACTOR — Improve while keeping tests green
```

## Core Rules

- Write the failing test first, make it pass with the smallest change, then refactor with tests green.
- Use `RefreshDatabase` and model factories for state; never depend on test order.
- Test behavior through HTTP and public interfaces; assert status, JSON shape, database state, and authorization boundaries (`assertForbidden`).
- Fake every external boundary (`Http::fake`, `Mail::fake`, `Queue::fake`, `Storage::fake`, `Event::fake`); do not mock Laravel internals.
- Enforce a coverage threshold in CI (`--coverage --min=` with Pest or clover output with PHPUnit).

## References

Code samples live in these files. Read only the one matching the task:
- `references/setup-and-factories.md`: PHPUnit configuration, base TestCase, defining and using model factories. Read when setting up a test suite or writing factories.
- `references/model-http-api-tests.md`: model tests, feature and HTTP tests, JSON API assertions, and Sanctum-authenticated API tests. Read when testing models, controllers, or APIs.
- `references/fakes-commands-authz-pest.md`: Http, Mail, Notification, Queue, Storage, and Event fakes; Artisan command tests; authorization tests; Pest feature tests; and coverage commands and goals. Read when mocking external services, testing commands or policies, using Pest, or wiring coverage into CI.

## Testing Best Practices

### DO

- Use factories over manual `create()` calls
- One logical assertion per test
- Descriptive names: `test_guests_cannot_create_products`
- Test edge cases and authorization boundaries
- Mock external services with `Http::fake()`, `Mail::fake()`
- Use `RefreshDatabase` for clean state

### DON'T

- Don't test Laravel internals (trust the framework)
- Don't make tests dependent on each other
- Don't over-mock — mock only service boundaries
- Don't test private methods — test through the public interface
- Don't couple tests to HTML structure

## Quick Reference

| Pattern | Usage |
|---------|-------|
| `RefreshDatabase` | Reset database between tests |
| `$this->actingAs($user)` | Authenticate as user |
| `$this->withToken($token)` | Bearer token auth for APIs |
| `Model::factory()->create()` | Create model with factory |
| `Model::factory()->count(5)->create()` | Create multiple records |
| `Http::fake([...])` | Mock HTTP calls |
| `Mail::fake()` | Trap sent mail |
| `Notification::fake()` | Trap sent notifications |
| `Queue::fake()` | Trap queued jobs |
| `Event::fake()` | Trap dispatched events |
| `Storage::fake('public')` | Trap file operations |
| `assertDatabaseHas` | Assert DB row exists |
| `assertSoftDeleted` | Assert soft-delete |
| `assertSessionHasErrors` | Assert validation errors |
| `assertForbidden` | Assert 403 status |

## Related Skills

- `laravel-specialist`: Laravel architecture, Eloquent, routing, and API patterns.
- `laravel-security`: Laravel authentication, authorization, and secure coding.
- `laravel-verification`: pre-deploy verification loop.
- `testing-guide`: human-facing testing walkthroughs in docs/TESTING_GUIDE.md.
