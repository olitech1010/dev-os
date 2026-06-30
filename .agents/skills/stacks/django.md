---
name: django-stack
description: Stack-specific coding standards for Django. Append this to the universal CLAUDE.md when working on a Django project.
---

# CLAUDE.md — Django Stack Context

> Append this to the universal `skills/CLAUDE.md` when working on a Django project.

---

## Stack

- **Framework:** Django (current stable) with Django REST Framework (DRF)
- **Language:** Python (current stable)
- **Auth:** djangorestframework-simplejwt or dj-rest-auth
- **Database:** PostgreSQL
- **Task Queue:** Celery + Redis
- **Testing:** pytest + pytest-django
- **Type Checking:** mypy (strict)
- **Linting:** Ruff
- **Formatting:** Black

---

## Project Structure

```
project_name/
├── config/                  ← Django settings (split by environment)
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   └── wsgi.py
├── apps/                    ← Django apps (one per domain)
│   ├── users/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py      ← Business logic
│   │   └── tests/
│   └── [feature]/
├── common/                  ← Shared utilities, mixins, base classes
│   ├── exceptions.py
│   ├── pagination.py
│   └── permissions.py
├── requirements/
│   ├── base.txt
│   ├── development.txt
│   └── production.txt
└── manage.py
```

---

## Architecture Rules

### Views Must Be Thin
Views handle HTTP only — request parsing, calling services, returning responses. No business logic.

```python
# ✅ Correct
class UserRegistrationView(CreateAPIView):
    serializer_class = UserRegistrationSerializer

    def perform_create(self, serializer):
        user_service.register_user(serializer.validated_data)

# ❌ Wrong — business logic in view
class UserRegistrationView(CreateAPIView):
    def create(self, request):
        user = User.objects.create_user(...)
        send_welcome_email.delay(user.id)
        Profile.objects.create(user=user)
        # ...
```

### Services
Business logic lives in `services.py` files. Services are plain Python functions or classes — no Django magic.

```python
# apps/users/services.py
def register_user(data: dict) -> User:
    user = User.objects.create_user(
        email=data['email'],
        password=data['password'],
    )
    send_welcome_email.delay(user.id)
    return user
```

### Serializers
- Serializers are for input validation and output shaping only
- Do not put business logic in `create()` or `update()` — call a service
- Always define `fields` explicitly — never use `fields = '__all__'`

### Models
- Use `verbose_name` and `verbose_name_plural` on every model
- Define `__str__` on every model
- Use `created_at` and `updated_at` (via abstract base model) on every model
- Never do computation in model `save()` — use signals or services sparingly

---

## Coding Conventions

```python
# ✅ Base model for timestamps
from django.db import models

class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

# ✅ Type annotations everywhere
def get_user_by_email(email: str) -> User | None:
    return User.objects.filter(email=email).first()
```

### Naming
| Type | Convention | Example |
|------|-----------|---------|
| Models | PascalCase | `UserProfile` |
| Views | PascalCase + View | `UserListView` |
| Serializers | PascalCase + Serializer | `UserCreateSerializer` |
| Services | snake_case functions | `register_user()` |
| URLs | kebab-case | `user-profile/` |
| Variables / functions | snake_case | `get_active_users()` |

---

## Forbidden Patterns

```python
# ❌ Business logic in views or serializers
# ❌ fields = '__all__' in serializers
# ❌ Raw SQL when ORM can handle it
# ❌ print() statements in production code
# ❌ Catching bare exceptions: except Exception: pass
# ❌ Mutable default arguments: def fn(items=[])
# ❌ Blocking operations in views (use Celery)
# ❌ Importing from settings directly in apps — use django.conf.settings
```

---

## Testing

```bash
pytest                          # Run all tests
pytest --cov=apps --cov-report=html   # Coverage
mypy .                          # Type checking
ruff check .                    # Linting
black --check .                 # Format check
```

- Every view must have a test
- Use `pytest.mark.django_db` only on tests that need DB access
- Use `mixer` or `factory_boy` for test data — never hardcode
- Separate test files per class: `tests/test_views.py`, `tests/test_services.py`

---

## Environment Variables Required

```bash
DJANGO_SECRET_KEY=
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=

DATABASE_URL=postgresql://user:password@host:5432/dbname

REDIS_URL=redis://localhost:6379/0

EMAIL_HOST=
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=
```

