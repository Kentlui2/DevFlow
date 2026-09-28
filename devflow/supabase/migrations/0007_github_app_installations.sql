-- GitHub App installation scoped access for private and public repositories.
alter table public.github_repositories
  add column if not exists github_id bigint,
  add column if not exists installation_id bigint;
create index if not exists idx_github_repositories_github_id
  on public.github_repositories(github_id);

create table if not exists public.project_github_installations (
  project_id uuid primary key references public.projects(id) on delete cascade,
  installation_id bigint not null,
  account_id bigint not null,
  account_login text not null,
  account_type text not null check (account_type in ('User', 'Organization', 'Enterprise')),
  connected_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_github_installations enable row level security;
drop policy if exists "Project members can view GitHub installation" on public.project_github_installations;
create policy "Project members can view GitHub installation" on public.project_github_installations
  for select to authenticated using (public.is_project_member(project_id));
drop policy if exists "Project owners manage GitHub installation" on public.project_github_installations;
create policy "Project owners manage GitHub installation" on public.project_github_installations
  for all to authenticated using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id) and connected_by = (select auth.uid()));
