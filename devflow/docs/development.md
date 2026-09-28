# Development

## Local setup

1. Install Node.js 22 or newer and npm.
2. Install dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local` and add the Supabase project URL and anon key from **Supabase → Project Settings → API**.
4. Apply database migrations `0001_init.sql` through `0007_github_app_installations.sql` in numeric order, or link the Supabase CLI to a development project and run `supabase db push`.
5. Start the app with `npm run dev`.

The GitHub App settings are optional for general development. To use private repository integration, set all five `GITHUB_APP_*` values in `.env.local`. The private key must contain the entire PEM key, including its begin/end lines; when represented on one line, use literal `\n` separators. Never commit `.env.local` or expose server secrets with a `NEXT_PUBLIC_` prefix.

## Verification

Run these checks before opening a pull request:

```text
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Vitest runs the unit/component suite. Playwright starts a local Next.js server and runs browser smoke checks for signed-out access control, sign-in rendering and error handling, and registration validation. Those browser tests use an isolated placeholder Supabase URL and do not need a real account or production credentials.

The GitHub Actions workflow runs the same checks on pull requests and pushes to `main` or `master`. See [deployment.md](./deployment.md) for production setup and release checks.
