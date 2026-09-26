-- Phase 5: secure task labels, assignments, and task editing at the database layer.

create or replace function public.can_manage_project_tasks(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = target_project_id
      and pm.user_id = (select auth.uid())
      and pm.role in ('owner', 'developer')
  );
$$;

revoke all on function public.can_manage_project_tasks(uuid) from public, anon;
grant execute on function public.can_manage_project_tasks(uuid) to authenticated;

alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

create unique index if not exists idx_labels_project_name_lower
  on public.labels (project_id, lower(name));

create index if not exists idx_task_labels_label_task
  on public.task_labels (label_id, task_id);

drop policy if exists "Project members can view labels" on public.labels;
drop policy if exists "Project editors can create labels" on public.labels;
drop policy if exists "Project editors can update labels" on public.labels;
drop policy if exists "Project editors can delete labels" on public.labels;

create policy "Project members can view labels"
  on public.labels for select to authenticated
  using (public.is_project_member(project_id));

create policy "Project editors can create labels"
  on public.labels for insert to authenticated
  with check (
    public.can_manage_project_tasks(project_id)
    and color ~ '^#[0-9A-Fa-f]{6}$'
  );

create policy "Project editors can update labels"
  on public.labels for update to authenticated
  using (public.can_manage_project_tasks(project_id))
  with check (
    public.can_manage_project_tasks(project_id)
    and color ~ '^#[0-9A-Fa-f]{6}$'
  );

create policy "Project editors can delete labels"
  on public.labels for delete to authenticated
  using (public.can_manage_project_tasks(project_id));

drop policy if exists "Project members can view task labels" on public.task_labels;
drop policy if exists "Project editors can attach task labels" on public.task_labels;
drop policy if exists "Project editors can detach task labels" on public.task_labels;

create policy "Project members can view task labels"
  on public.task_labels for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and public.is_project_member(t.project_id)
    )
  );

create policy "Project editors can attach task labels"
  on public.task_labels for insert to authenticated
  with check (
    exists (
      select 1
      from public.tasks t
      join public.labels l on l.id = label_id
      where t.id = task_id
        and t.project_id = l.project_id
        and public.can_manage_project_tasks(t.project_id)
    )
  );

create policy "Project editors can detach task labels"
  on public.task_labels for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and public.can_manage_project_tasks(t.project_id)
    )
  );

-- Replace links atomically so a failed label update never leaves a partial set.
create or replace function public.replace_task_labels(p_task_id uuid, p_label_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_project_id uuid;
begin
  select project_id into target_project_id
  from public.tasks
  where id = p_task_id;

  if target_project_id is null then
    raise exception 'TASK_NOT_FOUND';
  end if;
  if not public.can_manage_project_tasks(target_project_id) then
    raise exception 'PROJECT_TASK_EDITOR_REQUIRED';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_label_ids, '{}'::uuid[])) requested(label_id)
    left join public.labels l
      on l.id = requested.label_id and l.project_id = target_project_id
    where l.id is null
  ) then
    raise exception 'TASK_LABELS_MUST_BELONG_TO_PROJECT';
  end if;

  delete from public.task_labels where task_id = p_task_id;
  insert into public.task_labels (task_id, label_id)
  select p_task_id, requested.label_id
  from unnest(coalesce(p_label_ids, '{}'::uuid[])) requested(label_id)
  on conflict (task_id, label_id) do nothing;
end;
$$;

revoke all on function public.replace_task_labels(uuid, uuid[]) from public, anon;
grant execute on function public.replace_task_labels(uuid, uuid[]) to authenticated;

create or replace function public.enforce_task_project_assignments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and (
    new.id <> old.id
    or new.project_id <> old.project_id
    or new.created_by <> old.created_by
  ) then
    raise exception 'TASK_IDENTITY_IS_IMMUTABLE';
  end if;

  if new.assignee_id is not null and not exists (
    select 1
    from public.project_members pm
    where pm.project_id = new.project_id
      and pm.user_id = new.assignee_id
  ) then
    raise exception 'TASK_ASSIGNEE_MUST_BE_PROJECT_MEMBER';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.enforce_task_project_assignments() from public, anon, authenticated;

drop trigger if exists enforce_task_project_assignments on public.tasks;
create trigger enforce_task_project_assignments
  before insert or update on public.tasks
  for each row execute function public.enforce_task_project_assignments();

create or replace function public.prevent_label_project_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id <> old.id or new.project_id <> old.project_id then
    raise exception 'LABEL_IDENTITY_IS_IMMUTABLE';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_label_project_change() from public, anon, authenticated;

drop trigger if exists prevent_label_project_change on public.labels;
create trigger prevent_label_project_change
  before update on public.labels
  for each row execute function public.prevent_label_project_change();
