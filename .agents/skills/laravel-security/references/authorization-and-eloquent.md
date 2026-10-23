# laravel-security: Authorization and Eloquent Security

Split out of `../SKILL.md`. Code samples and detailed patterns.

## Authorization

### Gates

```php
// App\Providers\AuthServiceProvider
use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

public function boot(): void
{
    Gate::define('update-post', function (User $user, Post $post): bool {
        return $user->id === $post->user_id;
    });

    Gate::define('publish-post', function (User $user): bool {
        return $user->role === 'editor' || $user->role === 'admin';
    });

    // Using before() for super-admin override
    Gate::before(function (User $user, string $ability): ?bool {
        if ($user->role === 'super-admin') {
            return true; // Grants all abilities
        }
        return null; // Fall through to normal checks
    });
}

// Usage in controllers
public function update(Request $request, Post $post): RedirectResponse
{
    Gate::authorize('update-post', $post);
    // Or: $this->authorize('update-post', $post);
    // Or: abort_unless(Auth::user()->can('update-post', $post), 403);
    // ...
}
```

### Policies

```php
// App\Policies\PostPolicy
class PostPolicy
{
    use HandlesAuthorization;

    public function viewAny(?User $user): bool
    {
        return true; // Public listing
    }

    public function view(?User $user, Post $post): bool
    {
        return $post->is_published || ($user && $user->id === $post->user_id);
    }

    public function create(User $user): bool
    {
        return $user->hasVerifiedEmail(); // Must verify email first
    }

    public function update(User $user, Post $post): bool
    {
        return $user->id === $post->user_id;
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->id === $post->user_id && $post->created_at->diffInDays(now()) <= 30;
    }

    public function restore(User $user, Post $post): bool
    {
        return $user->role === 'admin';
    }

    public function forceDelete(User $user, Post $post): bool
    {
        return $user->role === 'super-admin';
    }
}

// Register in AuthServiceProvider
protected $policies = [
    Post::class => PostPolicy::class,
];

// Controller usage
public function show(Post $post): View
{
    $this->authorize('view', $post);
    return view('posts.show', compact('post'));
}

// Blade usage
@can('update', $post)
    <a href="{{ route('posts.edit', $post) }}">Edit</a>
@endcan

@cannot('update', $post)
    <span>You cannot edit this post</span>
@endcannot
```

### Middleware Authorization

```php
// Using middleware in routes
Route::put('/posts/{post}', [PostController::class, 'update'])
    ->middleware('can:update,post');

Route::get('/posts/create', [PostController::class, 'create'])
    ->middleware('can:create,App\Models\Post');

// Custom authorization middleware
// app/Http/Middleware/CheckRole.php
class CheckRole
{
    public function handle(Request $request, Closure $next, string $role): mixed
    {
        if (!$request->user() || $request->user()->role !== $role) {
            abort(403, 'Unauthorized. This area requires role: ' . $role);
        }
        return $next($request);
    }
}

// Register in Kernel
protected $routeMiddleware = [
    'role' => \App\Http\Middleware\CheckRole::class,
];

// Route usage
Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/admin', [AdminController::class, 'index']);
});
```

## Eloquent Security

### Mass Assignment Protection

```php
// BAD: $guarded = [] allows ALL columns to be mass-assigned
// NEVER use $guarded = [] in production

// GOOD: Whitelist fillable attributes
final class User extends Authenticatable
{
    protected $fillable = [
        'name',
        'email',
        'phone',
        'avatar',
    ];
    // NEVER add 'role', 'is_admin', 'is_verified' here
}

// GOOD: Explicitly control which fields can be filled in requests
public function store(StoreUserRequest $request): RedirectResponse
{
    $user = User::create($request->safe()->only([
        'name', 'email', 'phone', 'avatar'
    ]));
    // $request->safe() uses validated data only
    // $request->only() is NOT safe on its own without validation rules
}

// BAD: Creating a user with request data directly
User::create($request->all()); // VULNERABLE to mass assignment!

// BETTER: Use DTOs for creation
$user = User::create($request->validated()); // Only validated fields
```

### SQL Injection Prevention

```php
// GOOD: Eloquent automatically parameterizes queries
User::where('email', $userInput)->first();
User::whereRaw('email = ?', [$userInput])->first();

// GOOD: Query Builder also parameterizes
DB::table('users')->where('email', $userInput)->first();
DB::select('SELECT * FROM users WHERE email = ?', [$userInput]);

// BAD: Raw string interpolation
DB::select("SELECT * FROM users WHERE email = '{$userInput}'"); // VULNERABLE!
User::whereRaw("email = '{$userInput}'")->first(); // VULNERABLE!

// BAD: whereRaw/orderByRaw with unescaped input
User::orderByRaw($userInput); // VULNERABLE!
User::groupByRaw($userInput); // VULNERABLE!

// BAD: DB::statement with concatenation
DB::statement("INSERT INTO users (email) VALUES ('{$userInput}')"); // VULNERABLE!
```

### Attribute Casting

```php
final class User extends Authenticatable
{
    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_admin' => 'boolean', // Cast to boolean prevents string injection
        'settings' => 'array', // Automatically json_encode/json_decode
        'metadata' => 'encrypted:array', // Laravel 11+ encrypted casting
        'password' => 'hashed', // Laravel 10+ auto-hashes on set
    ];
}
```

### Model Security

```php
final class User extends Authenticatable
{
    // Hide sensitive attributes from JSON/API responses
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    // Append only safe computed attributes
    protected $appends = ['full_name']; // safe
    // NEVER append sensitive computed data
}

final class Post extends Model
{
    // Global scope to filter soft deleted records
    use SoftDeletes;

    // Prevent N+1 by restricting lazy loading (optional strict mode)
    // AppServiceProvider::boot()
    // Model::preventLazyLoading(!app()->isProduction());
}
```
