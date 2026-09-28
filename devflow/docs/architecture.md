# DevFlow — Architecture

## Stack (locked in)

- **Frontend:** Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui
- **API layer:** Next.js Route Handlers (`app/api/**`) — REST-style, not Server Actions, so the API is a reusable interface (useful later for a mobile client or GitHub integration webhooks, and it's the pattern most closely resembling what you'd build at a job)
- **Business logic:** plain TypeScript service functions, framework-agnostic, called by route handlers
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth (email/password for MVP; social providers are a cheap post-MVP add)
- **Validation:** Zod schemas, shared between client forms and API route input validation
- **Testing:** Vitest + React Testing Library (permissions and task board create/move behavior), Playwright (browser checks for signed-out redirects, sign-in errors, and registration validation)
- **Deployment:** Vercel (app) + Supabase (DB/auth), GitHub Actions for CI

## Request flow

```text
Client (React component)
   │  fetch()
   ▼
Route Handler (app/api/.../route.ts)
   │  1. auth: get session (Supabase server client)
   │  2. validate: Zod schema
   │  3. authorize: check project_members.role
   ▼
Service layer (lib/services/*.ts)
   │  business logic, calls Supabase client
   ▼
Supabase Postgres (+ RLS as second authorization layer)
```

Every route handler follows the same shape: **authenticate → validate input → authorize → call service → return typed response.** This is the pattern that gets tested and documented once, then repeated — it's also the cleanest thing to point to in a portfolio walkthrough ("here's how every mutation in this app is protected").

The production verification pipeline is documented in [`development.md`](./development.md) and runs through GitHub Actions. Browser smoke tests use placeholder Supabase settings and do not require a live account; the release checklist in [`deployment.md`](./deployment.md) covers the real Supabase-backed workflows before production promotion.

## Folder structure

```text
devflow/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx                     # project list
│   │   │   └── [projectId]/
│   │   │       ├── page.tsx                 # overview
│   │   │       ├── board/page.tsx
│   │   │       ├── backlog/page.tsx
│   │   │       ├── sprints/page.tsx
│   │   │       ├── issues/page.tsx
│   │   │       ├── members/page.tsx
│   │   │       ├── activity/page.tsx
│   │   │       └── analytics/page.tsx
│   │   ├── profile/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── projects/route.ts
│   │   ├── projects/[projectId]/route.ts
│   │   ├── projects/[projectId]/members/route.ts
│   │   ├── projects/[projectId]/tasks/route.ts
│   │   ├── tasks/[taskId]/route.ts
│   │   ├── tasks/[taskId]/comments/route.ts
│   │   └── ...  (issues, sprints, activities mirror the tasks pattern)
│   └── layout.tsx
├── components/
│   ├── ui/               # shadcn/ui primitives
│   ├── kanban/
│   ├── tasks/
│   ├── projects/
│   └── shared/
├── lib/
│   ├── services/          # business logic — taskService.ts, projectService.ts, etc.
│   ├── validation/        # Zod schemas, shared client + server
│   ├── auth/               # session helpers, permission checks
│   ├── supabase/           # server client, browser client
│   └── types/              # shared TS types (generated from DB + hand-written)
├── tests/
│   ├── unit/
│   └── e2e/
├── docs/
│   ├── architecture.md    # this file
│   ├── database.md
│   ├── api.md
│   ├── development.md
│   └── deployment.md
└── supabase/
    ├── migrations/
    └── seed.sql
```

## Authorization strategy

Permission checks live in one place: `lib/auth/permissions.ts`, exporting functions like `canEditTask(role)`, `canManageMembers(role)`, matching the permission table in the PRD exactly. Every route handler calls these — no permission logic duplicated across routes, and it's a single file to audit or test.

```ts
// lib/auth/permissions.ts (shape, not final code)
type Role = "owner" | "developer" | "viewer";

export const permissions = {
  editProject: (role: Role) => role === "owner",
  deleteProject: (role: Role) => role === "owner",
  manageMembers: (role: Role) => role === "owner",
  createTask: (role: Role) => role !== "viewer",
  editTask: (role: Role) => role !== "viewer",
  manageSprint: (role: Role) => role === "owner",
  comment: (role: Role) => role !== "viewer",
} as const;
```

RLS policies (see `database.md`) enforce the same rules independently at the DB level, so a missed check in a route handler doesn't turn into a real vulnerability.

## API design conventions

- REST-ish resource routes, nested under project where the resource belongs to one (`/api/projects/:id/tasks`).
- Standard response shape: `{ data }` on success, `{ error: { message, code } }` on failure — one error-handling path on the client.
- All mutations validated with Zod before touching the service layer; validation errors return `400` with field-level messages.
- Pagination via `?page=&limit=` on list endpoints from the start (activity feed and task lists will need it fast).

## Why Route Handlers over Server Actions

Server Actions are the more "idiomatic Next.js 2026" choice for form mutations, and they'd be less code. Route Handlers were chosen instead because: (1) a documented REST API is a clearer, more portable artifact for a portfolio case study than a set of server actions tied to your components, and (2) it leaves the door open for the GitHub-integration webhooks and a future mobile client without a rewrite. This is a deliberate trade-off worth calling out explicitly in the case study — it shows you can reason about API design, not just ship the fastest path.
