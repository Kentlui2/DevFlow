# DevFlow

A full-stack project management and collaboration platform for software development teams — projects, tasks, Kanban boards, issues, sprints, comments, activity history, RBAC, and analytics.

Built as a portfolio flagship project to demonstrate taking a product from requirements through system design, implementation, testing, and deployment.

## Status

**Phase 2 — Project Foundation.** Repo scaffolded: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui foundation, Supabase client/server helpers, folder structure, permission model, and an initial DB migration. No features are wired up to real data yet — that starts in Phase 3.

See `docs/` for the full design.

## Tech stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- **API:** Next.js Route Handlers (REST-style)
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth
- **Validation:** Zod
- **Testing:** Vitest + React Testing Library (unit), Playwright (E2E — added in Phase 10)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Apply the initial schema to your Supabase project:

```bash
supabase db push   # or paste supabase/migrations/0001_init.sql into the SQL editor
```

## Scripts

| Command                | Description                  |
| ---------------------- | ---------------------------- |
| `npm run dev`          | Start the dev server         |
| `npm run build`        | Production build             |
| `npm run lint`         | ESLint                       |
| `npm run format`       | Prettier (writes)            |
| `npm run format:check` | Prettier (check only)        |
| `npm test`             | Run unit tests once          |
| `npm run test:watch`   | Run unit tests in watch mode |

## Documentation

- [`docs/architecture.md`](./docs/architecture.md) — request flow, folder structure, authorization strategy, API conventions
- [`docs/database.md`](./docs/database.md) — ERD, table design, RLS policies

## Project roadmap

0. Product Planning — **done**
1. System Design — **done**
2. Project Foundation — **in progress**
3. Authentication & Authorization
4. Projects & Members
5. Task Management
6. Collaboration (comments, issues, activity)
7. Sprint Management
8. Analytics
9. Advanced Integrations (GitHub, real-time, notifications, attachments)
10. Production (testing, CI/CD, deployment, docs)
