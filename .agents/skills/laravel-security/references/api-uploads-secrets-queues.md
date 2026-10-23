# laravel-security: API, File Upload, Dependency, Secret, Queue, and Logging Security

Split out of `../SKILL.md`. Code samples and detailed patterns.

## API Security

### Rate Limiting

```php
// App/Providers/RouteServiceProvider
protected function configureRateLimiting(): void
{
    RateLimiter::for('api', function (Request $request) {
        return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
    });

    RateLimiter::for('auth', function (Request $request) {
        return Limit::perMinute(5)->by($request->ip())
            ->response(function () {
                return response()->json([
                    'message' => 'Too many login attempts. Try again in 1 minute.',
                ], 429);
            });
    });

    RateLimiter::for('uploads', function (Request $request) {
        return Limit::perHour(10)->by($request->user()?->id ?? $request->ip())
            ->response(function () {
                return response()->json([
                    'message' => 'Upload limit reached. Try again later.',
                ], 429);
            });
    });
}

// Route usage
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::apiResource('posts', PostController::class);
});

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:auth');
```

### API Authentication — Sanctum vs Passport

```php
// Sanctum (recommended for most apps — simple, first-party, SPA)
// config/sanctum.php
'expiration' => 60 * 24, // Tokens expire after 24 hours
'model' => User::class,

// Issuing scoped tokens
$token = $user->createToken('client-name', [
    'posts:read',
    'posts:write',
])->plainTextToken;

// Middleware scoping
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/posts', [PostController::class, 'index'])
        ->middleware('abilities:posts:read');

    Route::post('/posts', [PostController::class, 'store'])
        ->middleware('abilities:posts:write');
});

// Passport (OAuth2 — for third-party clients or complex auth flows)
// Install: composer require laravel/passport
Passport::tokensExpireIn(now()->addDays(15));
Passport::refreshTokensExpireIn(now()->addDays(30));
Passport::personalAccessTokensExpireIn(now()->addMonths(6));
```

### CORS Configuration

```php
// config/cors.php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', '')), // Whitelist specific origins
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['X-Total-Count', 'X-Pagination-Page'],
    'max_age' => 0,
    'supports_credentials' => true, // Required for Sanctum SPA auth
];

// NEVER: Allow all origins in production unless absolutely necessary
// 'allowed_origins' => ['*'], // Only for truly public APIs
```

## File Upload Security

### Validation

```php
public function rules(): array
{
    return [
        'document' => [
            'required',
            'file',
            'mimes:pdf,doc,docx,xls,xlsx', // Whitelist specific MIME types
            'max:10240', // 10MB
            'extensions:pdf,doc,docx,xls,xlsx', // Verify extension matches MIME
        ],
        'avatar' => [
            'nullable',
            'image', // Ensures it's a valid image
            'mimes:jpg,jpeg,png,webp',
            'max:2048',
            'dimensions:min_width=100,min_height=100,max_width=2000,max_height=2000',
        ],
    ];
}
```

### Secure Storage

```php
// Store files outside public directory
$path = $request->file('document')->store('documents', 'local');
// Never use 'public' disk for sensitive documents

// Use signed URLs for temporary file access
use Illuminate\Support\Facades\Storage;

public function download(Request $request, string $path)
{
    // Generate temporary signed URL (expires in 15 minutes)
    $url = Storage::temporaryUrl($path, now()->addMinutes(15));

    // Validate user has permission
    $this->authorize('download', $path);

    return redirect($url);
}

// Storage configuration for cloud with encryption
// config/filesystems.php
's3' => [
    'driver' => 's3',
    'key' => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION'),
    'bucket' => env('AWS_BUCKET'),
    'url' => env('AWS_URL'),
    'endpoint' => env('AWS_ENDPOINT'),
    'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
    'throw' => false,
    'server_side_encryption' => 'AES256', // Encrypt at rest
],
```

## Dependencies and Secrets

### Composer Security

```bash
# Always audit dependencies in CI
composer audit

# Pin major versions in composer.json
"laravel/framework": "^11.0",
"spatie/laravel-permission": "^6.0"

# Check for abandoned packages
composer why-not

# Keep lock file in version control (it pins exact versions)
# Run `composer update` deliberately, never in CI/CD
```

### Secret Management

```bash
# .env file (NEVER commit)
# .gitignore includes .env by default

APP_KEY=base64:abc123...
DB_PASSWORD=secure_password
STRIPE_KEY=sk_live_...
SANCTUM_TOKEN_PREFIX=myapp_

# For production: Use a secret manager
# Deploy with: env $(aws secretsmanager get-secret-value --secret-id prod/db | jq ...) php artisan serve

# Validate secrets at boot (AppServiceProvider::boot)
$secrets = ['services.stripe.key', 'services.stripe.webhook_secret'];
foreach ($secrets as $key) {
    if (empty(config($key))) {
        Log::critical("Missing secret: {$key}");
    }
}
```

## Queue Security

```php
// Define a named rate limiter (typically in AppServiceProvider::boot())
RateLimiter::for('payments', fn () => Limit::perMinute(5));
```

```php
// Encrypt sensitive job data by implementing the interface
final class ProcessPaymentJob implements ShouldQueue, ShouldBeEncrypted
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly string $paymentIntentId, // Public IDs are fine
        private readonly string $cardFingerprint, // Encrypted via ShouldBeEncrypted
    ) {}

    public function handle(): void
    {
        // Process payment
    }

    // Limit retries and delay between attempts
    public function retryUntil(): Carbon
    {
        return now()->addMinutes(5);
    }

    // Rate limit how many jobs of this type can run
    public function middleware(): array
    {
        return [
            new RateLimited('payments'),
        ];
    }
}
```

## Logging Security Events

```php
// config/logging.php
'channels' => [
    'security' => [
        'driver' => 'single',
        'path' => storage_path('logs/security.log'),
        'level' => 'warning',
    ],
],

// Audit log helper
final class SecurityLogger
{
    public static function log(string $event, array $context = []): void
    {
        Log::channel('security')->warning($event, array_merge([
            'user_id' => Auth::id(),
            'ip' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'url' => request()->fullUrl(),
            'timestamp' => now()->toIso8601String(),
        ], $context));
    }
}

// Usage
SecurityLogger::log('failed_login_attempt', ['email' => $email]);
SecurityLogger::log('password_change');
SecurityLogger::log('role_change', ['target_user' => $targetId, 'new_role' => 'admin']);
SecurityLogger::log('suspicious_activity', ['reason' => 'multiple_attempts_from_different_ips']);
```
