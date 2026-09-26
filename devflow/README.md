# DevFlow

A full-stack project management and collaboration platform for software development teams — projects, tasks, Kanban boards, issues, sprints, comments, activity history, RBAC, and analytics.

Built as a portfolio flagship project to demonstrate taking a product from requirements through system design, implementation, testing, and deployment.

## Status

**Phase 5 — Task Management (implemented; migration 0003 must be applied to the configured Supabase database).** Projects now have a responsive Kanban board with task CRUD, project-member assignment, priorities, due dates, labels, search, and filters. Task and label permissions are enforced by both the API and RLS.

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

If `0001_init.sql` and `0002_projects_and_members.sql` were already applied manually, apply `0003_task_management.sql` once in the Supabase SQL Editor, or reconcile the migration history before using `supabase db push`.

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
- [`docs/api.md`](./docs/api.md) — project, member, task, and label endpoint reference

## Project roadmap

0. Product Planning — **done**
1. System Design — **done**
2. Project Foundation — **in progress**
3. Authentication & Authorization
4. Projects & Members — **done**
5. Task Management — **implemented; database migration pending**
6. Collaboration (comments, issues, activity)
7. Sprint Management
8. Analytics
9. Advanced Integrations (GitHub, real-time, notifications, attachments)
10. Production (testing, CI/CD, deployment, docs)
