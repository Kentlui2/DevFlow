# DevFlow

A full-stack project management and collaboration platform for software development teams — projects, tasks, Kanban boards, issues, sprints, comments, activity history, RBAC, and analytics.

Built as a portfolio flagship project to demonstrate taking a product from requirements through system design, implementation, testing, and deployment.

## Status

**Phase 7 — Sprint Management (implemented; migration 0005 must be applied to the configured Supabase database).** Projects include an unscheduled-work backlog, sprint planning, owner-managed sprint lifecycles, task assignment to sprints, and completion progress. Phase 6 provides task and issue comments, issue tracking, and an automatically recorded activity feed. Permissions are enforced by the API and Supabase RLS.

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

Apply the migrations to your Supabase project. For a new database, link the Supabase CLI to the project and run:

```bash
supabase db push
```

If `0001_init.sql` through `0003_task_management.sql` were already applied manually, apply `0004_collaboration.sql` once in the Supabase SQL Editor, or reconcile the migration history before using `supabase db push`.

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
- [`docs/database.md`](./docs/database.md) — ERD, table design, and RLS policies
- [`docs/api.md`](./docs/api.md) — project, member, task, issue, comment, and activity endpoint reference

## Project roadmap

0. Product Planning — **done**
1. System Design — **done**
2. Project Foundation — **in progress**
3. Authentication & Authorization
4. Projects & Members — **done**
5. Task Management — **implemented**
6. Collaboration (comments, issues, activity) — **implemented**
7. Sprint Management — **implemented; migration 0005 pending**
8. Analytics
9. Advanced Integrations (GitHub, real-time, notifications, attachments)
10. Production (testing, CI/CD, deployment, docs)
