---
name: laravel-stack
description: Stack-specific coding standards for Laravel. Append this to the universal CLAUDE.md when working on a Laravel project.
---

# CLAUDE.md — Laravel Stack Context

> Append this to the universal `skills/CLAUDE.md` when working on a Laravel project.

---

## Stack

- **Framework:** Laravel (current stable)
- **Language:** PHP (current stable)
- **API:** Laravel Sanctum (SPA auth) or Passport (OAuth)
- **Database:** PostgreSQL (preferred) or MySQL
- **Queue:** Laravel Horizon + Redis
- **Testing:** PHPUnit + Pest
- **Code Style:** Laravel Pint (PSR-12 based)
- **Static Analysis:** PHPStan (level 8)

---

## Project Structure

```
app/
├── Http/
│   ├── Controllers/        ← Thin controllers — delegate to Actions
│   ├── Requests/           ← Form Request validation classes
│   ├── Resources/          ← API Resource transformers
│   └── Middleware/
├── Actions/                ← Single-responsibility action classes
├── Models/                 ← Eloquent models
├── Services/               ← Complex business logic / external API wrappers
├── Repositories/           ← Database query logic (optional — use if complex)
├── Events/ + Listeners/    ← Event-driven side effects
├── Jobs/                   ← Queueable tasks
└── Policies/               ← Authorization logic
database/
├── migrations/
├── seeders/
└── factories/
tests/
├── Feature/                ← HTTP-level feature tests
└── Unit/                   ← Pure unit tests
```

---

## Architecture Rules

### Controllers Must Be Thin
```php
// ✅ Correct — controller delegates to Action
public function store(StoreUserRequest $request, CreateUser $action): UserResource
{
    $user = $action->execute($request->validated());
    return new UserResource($user);
}

// ❌ Wrong — business logic in controller
public function store(Request $request): JsonResponse
{
    $request->validate([...]);
    $user = User::create([...]);
    Mail::to($user)->send(new WelcomeMail($user));
    // ...50 more lines
}
```

### Validation
- Always use **Form Request** classes — never `$request->validate()` inside the controller
- Validation is the only thing a Form Request does
- Return consistent API error shapes using the `failedValidation` override

### Authorization
- All authorization lives in **Policy** classes — never in controllers
- Use `$this->authorize()` in controllers — never manual permission checks inline
- Register policies in `AuthServiceProvider`

### Eloquent
- Define `$fillable` or `$guarded` on every model — never leave both empty
- Define relationships with return types: `public function posts(): HasMany`
- Never use raw `DB::` for queries that Eloquent can handle cleanly
- Use query scopes for reusable filters: `scopeActive()`, `scopeForUser()`

---

## Coding Conventions

```php
// ✅ Action class pattern
final class CreateUser
{
    public function execute(array $data): User
    {
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        event(new UserRegistered($user));

        return $user;
    }
}
```

### Naming
| Type | Convention | Example |
|------|-----------|---------|
| Controllers | PascalCase + Controller | `UserController` |
| Actions | Verb + Noun | `CreateUser`, `SendWelcomeEmail` |
| Events | Past tense | `UserRegistered`, `OrderShipped` |
| Jobs | Verb phrase | `ProcessPayment`, `SendReport` |
| Policies | Noun + Policy | `UserPolicy`, `PostPolicy` |
| Migrations | snake_case + descriptive | `create_users_table`, `add_role_to_users_table` |

---

## Forbidden Patterns

```php
// ❌ Business logic in controllers
// ❌ Raw queries when Eloquent works: DB::select("SELECT * FROM users WHERE id = $id")
// ❌ Hardcoded credentials or config values
// ❌ Mass assignment without $fillable: User::create($request->all())
// ❌ Suppressing errors with @
// ❌ echo or var_dump() in production code
// ❌ Skipping Form Requests for any endpoint that accepts user input
```

---

## Testing

```bash
php artisan test             # Run all tests
php artisan test --parallel  # Faster with parallel
./vendor/bin/pest            # Run with Pest
./vendor/bin/phpstan analyse # Static analysis
./vendor/bin/pint            # Code style fix
```

- Feature tests test HTTP endpoints end-to-end (use `RefreshDatabase`)
- Unit tests test pure logic (Actions, Services) without hitting the database
- Every API endpoint must have a feature test
- Use factories — never hardcode test data

---

## Environment Variables Required

```bash
APP_NAME=
APP_ENV=local
APP_KEY=                    # Generate with php artisan key:generate
APP_URL=

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=

QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
```

