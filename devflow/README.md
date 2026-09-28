# DevFlow

A full-stack project management and collaboration platform for software development teams — projects, tasks, Kanban boards, issues, sprints, comments, activity history, RBAC, and analytics.

Built as a portfolio flagship project to demonstrate taking a product from requirements through system design, implementation, testing, and deployment.

## Status

**Phase 10 — Production readiness (in progress).** Phase 9 integrations are implemented: projects can connect GitHub repositories, view recent commits/pull requests/issues, and link code references to tasks. Live project activity and comments refresh in real time; assignment, mention, comment, sprint, and pull request events create in-app notifications; tasks, issues, and comments support private file attachments. Phase 10 adds automated checks, end-to-end smoke coverage, CI, deployment guidance, and operations documentation.

See `docs/` for the full design.

## Tech stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- **API:** Next.js Route Handlers (REST-style)
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth
- **Validation:** Zod
- **Testing:** Vitest + React Testing Library (unit/component), Playwright (browser smoke tests)

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

If you have been applying migrations in the Supabase SQL Editor, apply `0006_advanced_integrations.sql` after the earlier migrations. It creates the private attachment bucket and access policies as well as notification, GitHub, and attachment tables. The migration adds the required tables to `supabase_realtime` when that publication is available.

GitHub public repositories can be linked by URL. Private repository access uses a GitHub App installation: each project owner installs the app for their GitHub account or organization and chooses the repositories to grant. DevFlow stores the installation and repository IDs, then creates short-lived installation tokens restricted to the requested repository. It does not store users' personal access tokens.

To enable the GitHub App flow, apply `supabase/migrations/0007_github_app_installations.sql`, then register a **public** GitHub App. Grant read-only **Contents**, **Issues**, and **Pull requests** permissions. Set the Setup URL to `https://YOUR_DEVFLOW_HOST/api/integrations/github/setup` and the Callback URL to `https://YOUR_DEVFLOW_HOST/api/integrations/github/callback`. Leave **Request user authorization (OAuth) during installation** off; DevFlow starts that authorization after the setup redirect so it can securely verify the installation. Enable **Redirect on update** so changes to repository selection sync back to DevFlow. Add `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and `GITHUB_APP_PRIVATE_KEY` to the server environment. Keep every value server-side; never use a `NEXT_PUBLIC_` prefix. The callback URL must exactly match the deployment URL registered in GitHub.

## Scripts

| Command                | Description                  |
| ---------------------- | ---------------------------- |
| `npm run dev`          | Start the dev server         |
| `npm run build`        | Production build             |
| `npm run lint`         | ESLint                       |
| `npm run typecheck`    | TypeScript check             |
| `npm run format`       | Prettier (writes)            |
| `npm run format:check` | Prettier (check only)        |
| `npm test`             | Run unit tests once          |
| `npm run test:watch`   | Run unit tests in watch mode |
| `npm run test:e2e`     | Run Playwright browser tests |

## Documentation

- [`docs/architecture.md`](./docs/architecture.md) — request flow, folder structure, authorization strategy, API conventions
- [`docs/database.md`](./docs/database.md) — ERD, table design, and RLS policies
- [`docs/api.md`](./docs/api.md) — project, member, task, issue, comment, activity, attachment, notification, and GitHub endpoint reference
- [`docs/development.md`](./docs/development.md) — local setup and verification commands
- [`docs/deployment.md`](./docs/deployment.md) — Supabase and Vercel production deployment, configuration, and smoke checks

## Project roadmap

0. Product Planning — **done**
1. System Design — **done**
2. Project Foundation — **done**
3. Authentication & Authorization — **implemented**
4. Projects & Members — **done**
5. Task Management — **implemented**
6. Collaboration (comments, issues, activity) — **implemented**
7. Sprint Management — **implemented**
8. Analytics — **implemented**
9. Advanced Integrations (GitHub, real-time, notifications, attachments) — **implemented**
10. Production (testing, CI/CD, deployment, docs) — **in progress**
