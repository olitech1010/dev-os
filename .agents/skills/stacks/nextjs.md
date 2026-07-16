---
name: nextjs-stack
description: Stack standard for Next.js 15, Supabase, Vercel
---
# Next.js 15 Stack Standard

## Tech Stack
- Framework: Next.js 15 (App Router)
- Language: TypeScript (Strict)
- Database/Auth: Supabase
- Hosting: Vercel
- Styling: Tailwind CSS / shadcn/ui

## Standards
- **App Router:** Use App Router exclusively. No `pages/` directory.
- **Server Components:** Default to Server Components. Only use `"use client"` when state, effects, or DOM events are needed.
- **Data Fetching:** Fetch data in Server Components natively. Use Supabase SSR package for auth and data.
- **Server Actions:** Use Server Actions for mutations instead of API Routes.
- **Auth:** Supabase Auth with RLS (Row Level Security) on all tables.
- **Deployment:** Deploy strictly to Vercel. Ensure `vercel.json` and build scripts are properly configured.
