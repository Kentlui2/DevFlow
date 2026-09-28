-- Phase 7: project backlogs and sprint planning.

create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  start_date date not null,
  end_date date not null,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed')),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprints_dates_valid check (end_date >= start_date),
  constraint sprints_project_name_unique unique (project_id, name)
);

create unique index if not exists idx_sprints_one_active_per_project
  on public.sprints (project_id) where status = 'active';
create index if not exists idx_sprints_project_status_dates
  on public.sprints (project_id, status, start_date, end_date);

create table if not exists public.sprint_tasks (
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (sprint_id, task_id)
);
create index if not exists idx_sprint_tasks_task_sprint
  on public.sprint_tasks (task_id, sprint_id);

alter table public.sprints enable row level security;
alter table public.sprint_tasks enable row level security;

drop policy if exists "Project members can view sprints" on public.sprints;
create policy "Project members can view sprints"
  on public.sprints for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "Project owners can create sprints" on public.sprints;
create policy "Project owners can create sprints"
  on public.sprints for insert to authenticated
  with check (
    public.is_project_owner(project_id)
    and created_by = (select auth.uid())
  );

drop policy if exists "Project owners can update sprints" on public.sprints;
create policy "Project owners can update sprints"
  on public.sprints for update to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

drop policy if exists "Project owners can delete sprints" on public.sprints;
create policy "Project owners can delete sprints"
  on public.sprints for delete to authenticated
  using (public.is_project_owner(project_id));

drop policy if exists "Project members can view sprint tasks" on public.sprint_tasks;
create policy "Project members can view sprint tasks"
  on public.sprint_tasks for select to authenticated
  using (
    exists (
      select 1 from public.sprints s
      where s.id = sprint_id and public.is_project_member(s.project_id)
    )
  );

drop policy if exists "Project owners can add sprint tasks" on public.sprint_tasks;
create policy "Project owners can add sprint tasks"
  on public.sprint_tasks for insert to authenticated
  with check (
    exists (
      select 1 from public.sprints s
      where s.id = sprint_id and public.is_project_owner(s.project_id)
    )
  );

drop policy if exists "Project owners can remove sprint tasks" on public.sprint_tasks;
create policy "Project owners can remove sprint tasks"
  on public.sprint_tasks for delete to authenticated
  using (
    exists (
      select 1 from public.sprints s
      where s.id = sprint_id and public.is_project_owner(s.project_id)
    )
  );

create or replace function public.enforce_sprint_rules()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.end_date < new.start_date then
    raise exception 'SPRINT_END_DATE_BEFORE_START_DATE';
  end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.project_id <> old.project_id
        or new.created_by <> old.created_by or new.created_at <> old.created_at then
      raise exception 'SPRINT_IDENTITY_IS_IMMUTABLE';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'planned' and new.status = 'active')
      or (old.status = 'active' and new.status = 'completed')
    ) then
      raise exception 'SPRINT_STATUS_TRANSITION_INVALID';
    end if;
    if old.status <> 'planned' and (
      new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date
    ) then
      raise exception 'SPRINT_DATES_LOCKED_AFTER_START';
    end if;
  end if;
  new.name := trim(new.name);
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.enforce_sprint_rules() from public, anon, authenticated;
drop trigger if exists enforce_sprint_rules on public.sprints;
create trigger enforce_sprint_rules
  before insert or update on public.sprints
  for each row execute function public.enforce_sprint_rules();

create or replace function public.validate_sprint_task()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sprint_project_id uuid;
  task_project_id uuid;
  sprint_status text;
begin
  select project_id, status into sprint_project_id, sprint_status
  from public.sprints where id = new.sprint_id;
  select project_id into task_project_id
  from public.tasks where id = new.task_id;
  if sprint_project_id is null or task_project_id is null
      or sprint_project_id <> task_project_id then
    raise exception 'SPRINT_TASK_MUST_BELONG_TO_PROJECT';
  end if;
  if sprint_status = 'completed' then
    raise exception 'CANNOT_ADD_TASK_TO_COMPLETED_SPRINT';
  end if;
  if tg_op = 'UPDATE' and (
    new.sprint_id <> old.sprint_id or new.task_id <> old.task_id
  ) then
    raise exception 'SPRINT_TASK_IDENTITY_IS_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_sprint_task() from public, anon, authenticated;
drop trigger if exists validate_sprint_task on public.sprint_tasks;
create trigger validate_sprint_task
  before insert or update on public.sprint_tasks
  for each row execute function public.validate_sprint_task();

create or replace function public.log_sprint_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'INSERT' then
    perform public.record_project_activity(new.project_id, 'sprint.created', 'sprint', new.id,
      jsonb_build_object('name', new.name, 'status', new.status));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.record_project_activity(old.project_id, 'sprint.deleted', 'sprint', old.id,
      jsonb_build_object('name', old.name));
    return old;
  end if;
  if new.status is distinct from old.status then
    perform public.record_project_activity(new.project_id, 'sprint.status_changed', 'sprint', new.id,
      jsonb_build_object('name', new.name, 'from_status', old.status, 'to_status', new.status));
  elsif new.name is distinct from old.name
      or new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date then
    perform public.record_project_activity(new.project_id, 'sprint.updated', 'sprint', new.id,
      jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;
revoke all on function public.log_sprint_change() from public, anon, authenticated;
drop trigger if exists log_sprint_change on public.sprints;
create trigger log_sprint_change
  after insert or update or delete on public.sprints
  for each row execute function public.log_sprint_change();

create or replace function public.log_sprint_task_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sprint_project_id uuid;
  sprint_name text;
  task_title text;
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'INSERT' then
    select project_id, name into sprint_project_id, sprint_name
      from public.sprints where id = new.sprint_id;
    select title into task_title from public.tasks where id = new.task_id;
    if sprint_project_id is not null then
      perform public.record_project_activity(sprint_project_id, 'sprint.task_added', 'sprint', new.sprint_id,
        jsonb_build_object('name', sprint_name, 'task_title', task_title));
    end if;
    return new;
  end if;
  select project_id, name into sprint_project_id, sprint_name
    from public.sprints where id = old.sprint_id;
  select title into task_title from public.tasks where id = old.task_id;
  if sprint_project_id is not null then
    perform public.record_project_activity(sprint_project_id, 'sprint.task_removed', 'sprint', old.sprint_id,
      jsonb_build_object('name', sprint_name, 'task_title', task_title));
  end if;
  return old;
end;
$$;
revoke all on function public.log_sprint_task_change() from public, anon, authenticated;
drop trigger if exists log_sprint_task_change on public.sprint_tasks;
create trigger log_sprint_task_change
  after insert or delete on public.sprint_tasks
  for each row execute function public.log_sprint_task_change();
