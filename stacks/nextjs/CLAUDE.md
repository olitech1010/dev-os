# CLAUDE.md — Next.js Stack Context

> Append this to the universal `skills/CLAUDE.md` when working on a Next.js project. Remove sections that don't apply.

---

## Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict mode — `"strict": true` in tsconfig)
- **Styling:** Tailwind CSS
- **Database:** [Supabase / Prisma+PostgreSQL / PlanetScale — pick yours]
- **Auth:** [Supabase Auth / NextAuth / Clerk — pick yours]
- **State:** [Zustand / Jotai / React Context — pick yours]
- **Forms:** [React Hook Form + Zod / conform — pick yours]
- **Testing:** Vitest + React Testing Library + Playwright (E2E)

---

## Project Structure

```
src/
├── app/                    ← App Router pages and layouts
│   ├── (auth)/             ← Route group: auth pages (login, register, reset)
│   ├── (dashboard)/        ← Route group: protected app pages
│   ├── api/                ← API routes (use sparingly — prefer Server Actions)
│   ├── layout.tsx          ← Root layout
│   └── globals.css         ← Global styles
├── components/
│   ├── ui/                 ← Primitive UI components (Button, Input, Modal, etc.)
│   └── [feature]/          ← Feature-specific components
├── lib/
│   ├── supabase/           ← Supabase client (server + client)
│   ├── validations/        ← Zod schemas
│   └── utils.ts            ← Shared utility functions
├── server/
│   ├── actions/            ← Server Actions (grouped by domain)
│   └── queries/            ← Database query functions
├── hooks/                  ← Custom React hooks
├── types/                  ← Global TypeScript types
└── constants/              ← App-wide constants
```

---

## Architecture Rules

### Server vs Client
- Default to **Server Components** — opt into `'use client'` only when necessary
- Client components are needed for: event listeners, browser APIs, useState, useEffect
- Never fetch data in client components when a server component can do it
- Use **Server Actions** for mutations — not API routes unless exposing a public API

### Data Fetching
- Fetch in Server Components or Server Actions — not in `useEffect`
- Use `React.cache()` for expensive data shared across a request
- Parallel fetch with `Promise.all()` when data is independent

### Routing
- Colocate page-specific components inside the `app/` route folder
- Use route groups `(groupName)` to organise routes without affecting the URL
- Loading states: always provide `loading.tsx` for routes with async data
- Error states: always provide `error.tsx` for routes that can fail

---

## Coding Conventions

### Components
```typescript
// ✅ Correct — named export, typed props, descriptive name
interface UserCardProps {
  userId: string
  showEmail?: boolean
}

export function UserCard({ userId, showEmail = false }: UserCardProps) {
  // ...
}

// ❌ Wrong — default export, any types, vague name
export default function Card({ data }: any) {}
```

### Server Actions
```typescript
// ✅ Correct
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function loginAction(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }
  // proceed with validated data
}
```

### TypeScript Rules
- `strict: true` — no exceptions
- Never use `any` — use `unknown` and narrow it, or define the correct type
- Define response shapes explicitly — no implicit `{}` returns
- Use `type` for object shapes, `interface` only when extending is needed
- Prefer `const` — only use `let` when reassignment is required

---

## Forbidden Patterns

```typescript
// ❌ Never use any
const data: any = await fetch(...)

// ❌ Never bypass TypeScript
// @ts-ignore
// @ts-expect-error (without explanation)

// ❌ Never fetch in useEffect for initial data
useEffect(() => {
  fetch('/api/user').then(...)
}, [])

// ❌ Never use API routes for internal mutations
// Use Server Actions instead

// ❌ Never put business logic in components
// Extract to server/actions/ or server/queries/

// ❌ Never use default exports for components
export default function MyComponent() {} // don't do this
```

---

## Required Patterns

```typescript
// ✅ Always validate with Zod at boundaries
const schema = z.object({ id: z.string().uuid() })
const result = schema.safeParse(input)
if (!result.success) return { error: 'Invalid input' }

// ✅ Always handle loading and error states in UI
if (isLoading) return <Skeleton />
if (error) return <ErrorMessage message={error} />

// ✅ Always use environment variable validation at startup
// lib/env.ts — use @t3-oss/env-nextjs or zod to validate all env vars
```

---

## Testing

```bash
# Unit + integration tests
npx vitest

# E2E tests
npx playwright test

# Coverage report
npx vitest --coverage
```

- Test files colocated with source: `UserCard.test.tsx` next to `UserCard.tsx`
- E2E tests in `tests/e2e/`
- Minimum 80% coverage on `server/actions/` and `server/queries/`
- Mock Supabase at the boundary — do not hit real DB in unit tests

---

## Environment Variables Required

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=                  # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=             # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY=                 # Supabase service role (server only — never expose)
DATABASE_URL=                              # Direct DB connection (for migrations)
NEXTAUTH_SECRET=                           # Random secret for session encryption
NEXT_PUBLIC_APP_URL=                       # Full URL of the app (used for redirects)
```

---

## Deployment (Vercel)

See `stacks/nextjs/DEPLOYMENT.md` for full guide.

Quick checklist:
- [ ] `NEXTAUTH_URL` set to production URL
- [ ] All env vars added in Vercel dashboard
- [ ] `output: 'standalone'` if deploying to non-Vercel hosts
- [ ] Image domains added to `next.config.ts`
- [ ] Rate limiting enabled on auth routes
