# laravel-tdd: Fakes, Artisan Commands, Authorization, Pest, and Coverage

Split out of `../SKILL.md`. Code samples and detailed patterns.

## Mocking and Fakes

### HTTP Fake

```php
use Illuminate\Support\Facades\Http;

public function test_it_handles_successful_payment(): void
{
    Http::fake([
        'api.stripe.com/*' => Http::response(['id' => 'pi_123', 'status' => 'succeeded'], 200),
    ]);

    $result = (new PaymentService())->charge(2999);
    $this->assertTrue($result->success);
}

public function test_it_handles_gateway_failure(): void
{
    Http::fake([
        'api.stripe.com/*' => Http::response(['error' => 'card_declined'], 402),
    ]);

    $this->expectException(PaymentFailedException::class);
    (new PaymentService())->charge(2999);
}

public function test_it_retries_on_timeout(): void
{
    Http::fake([
        'api.stripe.com/*' => Http::sequence()
            ->pushStatus(408)
            ->pushStatus(200),
    ]);

    $this->assertTrue((new PaymentService())->charge(2999)->success);
}
```

### Mail Fake

```php
Mail::fake();

$order->sendConfirmation();

Mail::assertSent(OrderConfirmation::class, function ($mail) use ($order) {
    return $mail->hasTo($order->user->email);
});
```

### Notification Fake

```php
Notification::fake();

$user->notify(new WelcomeUser());

Notification::assertSentTo($user, WelcomeUser::class);
```

### Queue Fake

```php
Queue::fake();

ProcessImage::dispatch($product);

Queue::assertPushed(ProcessImage::class, function ($job) use ($product) {
    return $job->product->id === $product->id;
});
```

### Storage Fake

```php
Storage::fake('public');

$file = UploadedFile::fake()->image('photo.jpg', 200, 200);

$response = $this->actingAs($user)->post('/avatar', [
    'avatar' => $file,
]);

$response->assertSessionHasNoErrors();
Storage::disk('public')->assertExists('avatars/' . $file->hashName());
```

### Event Fake

```php
Event::fake();

$order->markAsShipped();

Event::assertDispatched(OrderShipped::class, function ($event) use ($order) {
    return $event->order->id === $order->id;
});
```

## Artisan Command Tests

```php
public function test_it_sends_newsletters(): void
{
    Mail::fake();
    User::factory()->count(5)->create(['subscribed' => true]);

    $this->artisan('newsletter:send')
        ->expectsOutput('Sending newsletter to 5 subscribers...')
        ->assertExitCode(0);

    Mail::assertSent(NewsletterMail::class, 5);
}

public function test_it_handles_no_subscribers(): void
{
    $this->artisan('newsletter:send')
        ->expectsOutput('No subscribers found.')
        ->assertExitCode(0);
}
```

## Authorization Tests

```php
public function test_users_can_update_own_posts(): void
{
    $user = User::factory()->create();
    $post = Post::factory()->create(['user_id' => $user->id]);

    $this->actingAs($user)
        ->put(route('posts.update', $post), ['title' => 'Updated'])
        ->assertRedirect();
}

public function test_users_cannot_update_others_posts(): void
{
    $post = Post::factory()->create();
    $this->actingAs(User::factory()->create())
        ->put(route('posts.update', $post), ['title' => 'Hacked'])
        ->assertForbidden();
}

public function test_gate_before_grants_super_admin_full_access(): void
{
    $super = User::factory()->create(['role' => 'super-admin']);
    $post = Post::factory()->create();

    $this->actingAs($super)
        ->delete(route('posts.destroy', $post))
        ->assertRedirect();

    $this->assertSoftDeleted($post);
}
```

## Pest Feature Tests

```php
<?php

use App\Models\Product;
use App\Models\User;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('lists products', function () {
    Product::factory()->count(3)->create(['user_id' => $this->user->id]);

    $this->get(route('products.index'))
        ->assertOk()
        ->assertViewHas('products');
});

it('creates a product with valid data', function () {
    $this->post(route('products.store'), [
        'name' => 'Test Product', 'price' => 1999,
    ])->assertRedirect();

    $this->assertDatabaseHas('products', ['name' => 'Test Product']);
});

it('fails validation without required fields', function () {
    $this->post(route('products.store'), [])
        ->assertSessionHasErrors(['name', 'price']);
});

it('authorizes updates', function () {
    $other = User::factory()->create();
    $product = Product::factory()->create(['user_id' => $other->id]);

    $this->put(route('products.update', $product), ['name' => 'Hacked'])
        ->assertForbidden();
});
```

## Coverage

```bash
# PHPUnit (use clover output for CI threshold checks)
vendor/bin/phpunit --coverage-html coverage --coverage-clover clover.xml

# Pest (built-in threshold support)
vendor/bin/pest --coverage --min=80
```

### Coverage Goals

| Component | Target |
|-----------|--------|
| Models | 95%+ |
| Actions/Services | 90%+ |
| Form Requests | 90%+ |
| Controllers | 85%+ |
| Policies | 95%+ |
| Overall | 80%+ |
