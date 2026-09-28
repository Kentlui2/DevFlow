# Production deployment

DevFlow is designed to run on Vercel with Supabase for Postgres, authentication, realtime, and private file storage. Complete the Supabase setup before deploying the app.

## 1. Prepare Supabase

1. Create a production Supabase project and save its database backup and recovery details.
2. Apply migrations `0001_init.sql` through `0007_github_app_installations.sql` in order. Prefer the Supabase CLI (`supabase link` followed by `supabase db push`) so the migration history is recorded. The SQL Editor is an alternative for a new project; run each migration once, in numeric order.
3. Copy the Project URL and anon/publishable key from **Project Settings → API**.
4. In **Authentication → URL Configuration**, set the production Site URL and allow the production `/auth/callback` route. Add any intentional preview or staging callback URLs separately.
5. Confirm the private attachments bucket and policies from migration `0006_advanced_integrations.sql` exist. Do not make the bucket public.

## 2. Deploy the web app

1. Import the DevFlow repository into Vercel and select the directory containing this `package.json` as the project root.
2. Use the standard Next.js build command, `npm run build`, and install command, `npm ci`.
3. Add the following environment variables to Vercel's Production environment:

   | Variable                        | Required               | Notes                                                                                       |
   | ------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | Yes                    | Production Supabase project URL.                                                            |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes                    | Supabase anon/publishable key; protected data still relies on RLS.                          |
   | `GITHUB_APP_ID`                 | For GitHub integration | GitHub App identifier.                                                                      |
   | `GITHUB_APP_SLUG`               | For GitHub integration | App slug used to start installation.                                                        |
   | `GITHUB_APP_CLIENT_ID`          | For GitHub integration | GitHub App OAuth client ID.                                                                 |
   | `GITHUB_APP_CLIENT_SECRET`      | For GitHub integration | Server-only OAuth secret.                                                                   |
   | `GITHUB_APP_PRIVATE_KEY`        | For GitHub integration | Entire server-only PEM key; use `\n` for line breaks if required by the environment editor. |

   Add integration secrets only to the Production environment if the integration is enabled. Never set private credentials as `NEXT_PUBLIC_*`. The app does not need the Supabase service-role key at runtime.

4. Deploy to a preview first, then promote the verified deployment to Production. Vercel's Git integration can create preview deployments for pull requests and production deployments for the configured branch. Keep the CI status checks required before merging.

## 3. Configure GitHub App for production

If GitHub integration is enabled, update the GitHub App's Setup URL to `https://YOUR_PRODUCTION_HOST/api/integrations/github/setup` and its Callback URL to `https://YOUR_PRODUCTION_HOST/api/integrations/github/callback`. Keep OAuth authorization during installation disabled and enable redirect on update. Ensure the App has read-only Contents, Issues, and Pull requests permissions. Update these URLs whenever the production hostname changes. Preview deployments need a separately configured callback if you intend to test the full GitHub flow there.

## 4. Release smoke check

After deployment, verify the following with a non-production test account and project:

- Sign up, email confirmation, sign in, sign out, password reset, and protected-page redirects.
- Create a project, invite/manage a member, and confirm owner/developer/viewer permissions.
- Create and update a task, move it across board statuses, and confirm the change persists after refresh.
- Add a comment and attachment; confirm the attachment is accessible only to authorized project members.
- Open the same project in two sessions and confirm comments/activity refresh; verify an in-app notification is created for supported events.
- If configured, install the GitHub App on a test repository, sync its granted repositories, and confirm repository activity loads.
- Review Vercel function logs and Supabase logs for errors. Remove test users and data when finished.

## Rollback and operations

Use Vercel's deployment history to roll the app back to the previous deployment. Treat database migrations as forward-only unless a reviewed rollback has been prepared; take a Supabase backup before production schema changes and prefer additive, backward-compatible migrations. Keep GitHub App credentials in the hosting provider's secret store, rotate them after suspected exposure, and update the matching GitHub App registration when rotating OAuth credentials or callback URLs.
