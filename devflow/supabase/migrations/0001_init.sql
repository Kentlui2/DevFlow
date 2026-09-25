-- DevFlow initial schema
-- See docs/database.md for the full design rationale.

create extension if not exists "pgcrypto";

-- Mirrors auth.users; kept in sync by the trigger below.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'developer', 'viewer')),
  joined_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index idx_project_members_project_user on public.project_members(project_id, user_id);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280'
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'backlog'
    check (status in ('backlog', 'todo', 'in_progress', 'in_review', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid references public.users(id),
  created_by uuid not null references public.users(id),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_project_status on public.tasks(project_id, status);
create index idx_tasks_assignee on public.tasks(assignee_id);

create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- Issues, issue_labels, sprints, sprint_tasks follow the same shape as
-- tasks/task_labels and are added in Phase 7 (Sprint Management) and
-- the post-MVP issue tracking phase, rather than speculatively now.

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id),
  commentable_type text not null check (commentable_type in ('task', 'issue')),
  commentable_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid not null references public.users(id),
  action_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_activities_project_created on public.activities(project_id, created_at desc);

-- Row Level Security -------------------------------------------------
-- Defense in depth alongside the API-layer checks in
-- src/lib/auth/permissions.ts. See docs/database.md for the policy list.

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.activities enable row level security;

create policy "Members can view their projects"
  on public.projects for select
  using (
    exists (
      select 1 from public.project_members
      where project_id = projects.id and user_id = auth.uid()
    )
  );

create policy "Owners can update their projects"
  on public.projects for update
  using (owner_id = auth.uid());

create policy "Owners can delete their projects"
  on public.projects for delete
  using (owner_id = auth.uid());

create policy "Authenticated users can create projects"
  on public.projects for insert
  with check (owner_id = auth.uid());

create policy "Members can view project membership"
  on public.project_members for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id and pm.user_id = auth.uid()
    )
  );

create policy "Members can view project tasks"
  on public.tasks for select
  using (
    exists (
      select 1 from public.project_members
      where project_id = tasks.project_id and user_id = auth.uid()
    )
  );

create policy "Owners and developers can manage tasks"
  on public.tasks for all
  using (
    exists (
      select 1 from public.project_members
      where project_id = tasks.project_id
        and user_id = auth.uid()
        and role in ('owner', 'developer')
    )
  );
