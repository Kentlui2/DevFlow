-- Phase 6: issue tracking, comments, and an append-only project activity feed.

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  issue_number bigint generated always as identity unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid references public.users(id) on delete set null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_issues_project_status
  on public.issues (project_id, status, created_at desc);
create index if not exists idx_issues_assignee on public.issues (assignee_id);

create table if not exists public.issue_labels (
  issue_id uuid not null references public.issues(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (issue_id, label_id)
);
create index if not exists idx_issue_labels_label_issue
  on public.issue_labels (label_id, issue_id);
create index if not exists idx_comments_target_created
  on public.comments (commentable_type, commentable_id, created_at);
alter table public.comments add column if not exists author_name text;
update public.comments c
set author_name = coalesce(nullif(u.full_name, ''), u.email)
from public.users u
where c.author_id = u.id and c.author_name is null;

alter table public.issues enable row level security;
alter table public.issue_labels enable row level security;

create or replace function public.comment_target_in_project(
  target_type text,
  target_id uuid,
  target_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case target_type
    when 'task' then exists (
      select 1 from public.tasks t
      where t.id = target_id and t.project_id = target_project_id
    )
    when 'issue' then exists (
      select 1 from public.issues i
      where i.id = target_id and i.project_id = target_project_id
    )
    else false
  end;
$$;

revoke all on function public.comment_target_in_project(text, uuid, uuid)
  from public, anon;
grant execute on function public.comment_target_in_project(text, uuid, uuid)
  to authenticated;

drop policy if exists "Project members can view issues" on public.issues;
create policy "Project members can view issues"
  on public.issues for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "Project editors can create issues" on public.issues;
create policy "Project editors can create issues"
  on public.issues for insert to authenticated
  with check (
    public.can_manage_project_tasks(project_id)
    and created_by = (select auth.uid())
  );

drop policy if exists "Project editors can update issues" on public.issues;
create policy "Project editors can update issues"
  on public.issues for update to authenticated
  using (public.can_manage_project_tasks(project_id))
  with check (public.can_manage_project_tasks(project_id));

drop policy if exists "Project editors can delete issues" on public.issues;
create policy "Project editors can delete issues"
  on public.issues for delete to authenticated
  using (public.can_manage_project_tasks(project_id));

drop policy if exists "Project members can view issue labels" on public.issue_labels;
create policy "Project members can view issue labels"
  on public.issue_labels for select to authenticated
  using (
    exists (
      select 1 from public.issues i
      where i.id = issue_id and public.is_project_member(i.project_id)
    )
  );

drop policy if exists "Project editors can attach issue labels" on public.issue_labels;
create policy "Project editors can attach issue labels"
  on public.issue_labels for insert to authenticated
  with check (
    exists (
      select 1
      from public.issues i
      join public.labels l on l.id = label_id
      where i.id = issue_id
        and i.project_id = l.project_id
        and public.can_manage_project_tasks(i.project_id)
    )
  );

drop policy if exists "Project editors can detach issue labels" on public.issue_labels;
create policy "Project editors can detach issue labels"
  on public.issue_labels for delete to authenticated
  using (
    exists (
      select 1 from public.issues i
      where i.id = issue_id and public.can_manage_project_tasks(i.project_id)
    )
  );

drop policy if exists "Project members can view task and issue comments" on public.comments;
create policy "Project members can view task and issue comments"
  on public.comments for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = commentable_id
        and commentable_type = 'task'
        and public.is_project_member(t.project_id)
    )
    or exists (
      select 1 from public.issues i
      where i.id = commentable_id
        and commentable_type = 'issue'
        and public.is_project_member(i.project_id)
    )
  );

drop policy if exists "Project editors can add task and issue comments" on public.comments;
create policy "Project editors can add task and issue comments"
  on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.tasks t
      where t.id = commentable_id
        and commentable_type = 'task'
        and public.can_manage_project_tasks(t.project_id)
    )
    or author_id = (select auth.uid())
    and exists (
      select 1 from public.issues i
      where i.id = commentable_id
        and commentable_type = 'issue'
        and public.can_manage_project_tasks(i.project_id)
    )
  );

drop policy if exists "Authors can edit their comments" on public.comments;
create policy "Authors can edit their comments"
  on public.comments for update to authenticated
  using (
    author_id = (select auth.uid())
    and (
      exists (
        select 1 from public.tasks t
        where t.id = commentable_id and commentable_type = 'task'
          and public.can_manage_project_tasks(t.project_id)
      )
      or exists (
        select 1 from public.issues i
        where i.id = commentable_id and commentable_type = 'issue'
          and public.can_manage_project_tasks(i.project_id)
      )
    )
  )
  with check (author_id = (select auth.uid()));

drop policy if exists "Authors can delete their comments" on public.comments;
create policy "Authors can delete their comments"
  on public.comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    and (
      exists (
        select 1 from public.tasks t
        where t.id = commentable_id and commentable_type = 'task'
          and public.can_manage_project_tasks(t.project_id)
      )
      or exists (
        select 1 from public.issues i
        where i.id = commentable_id and commentable_type = 'issue'
          and public.can_manage_project_tasks(i.project_id)
      )
    )
  );

create or replace function public.validate_comment_target()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  author_name_snapshot text;
begin
  if new.author_id <> (select auth.uid()) then
    raise exception 'COMMENT_AUTHOR_MUST_BE_CURRENT_USER';
  end if;
  if tg_op = 'INSERT' then
    select coalesce(nullif(full_name, ''), email) into author_name_snapshot
    from public.users where id = new.author_id;
    new.author_name := author_name_snapshot;
  end if;
  if not public.comment_target_in_project(new.commentable_type, new.commentable_id,
      case new.commentable_type
        when 'task' then (select project_id from public.tasks where id = new.commentable_id)
        when 'issue' then (select project_id from public.issues where id = new.commentable_id)
        else null
      end
    ) then
    raise exception 'COMMENT_TARGET_NOT_FOUND';
  end if;
  if tg_op = 'UPDATE' and (
    new.id <> old.id or new.author_id <> old.author_id
    or new.commentable_type <> old.commentable_type
    or new.commentable_id <> old.commentable_id
    or new.author_name is distinct from old.author_name
  ) then
    raise exception 'COMMENT_IDENTITY_IS_IMMUTABLE';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.validate_comment_target() from public, anon, authenticated;
drop trigger if exists validate_comment_target on public.comments;
create trigger validate_comment_target
  before insert or update on public.comments
  for each row execute function public.validate_comment_target();

create or replace function public.enforce_issue_project_assignments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and (
    new.id <> old.id or new.issue_number <> old.issue_number
    or new.project_id <> old.project_id or new.created_by <> old.created_by
  ) then
    raise exception 'ISSUE_IDENTITY_IS_IMMUTABLE';
  end if;
  if new.assignee_id is not null and not exists (
    select 1 from public.project_members pm
    where pm.project_id = new.project_id and pm.user_id = new.assignee_id
  ) then
    raise exception 'ISSUE_ASSIGNEE_MUST_BE_PROJECT_MEMBER';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.enforce_issue_project_assignments() from public, anon, authenticated;
drop trigger if exists enforce_issue_project_assignments on public.issues;
create trigger enforce_issue_project_assignments
  before insert or update on public.issues
  for each row execute function public.enforce_issue_project_assignments();

create or replace function public.prevent_issue_label_project_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.issue_id <> old.issue_id then
    raise exception 'ISSUE_LABEL_IDENTITY_IS_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_issue_label_project_change() from public, anon, authenticated;
drop trigger if exists prevent_issue_label_project_change on public.issue_labels;
create trigger prevent_issue_label_project_change
  before update on public.issue_labels
  for each row execute function public.prevent_issue_label_project_change();

create or replace function public.replace_issue_labels(p_issue_id uuid, p_label_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_project_id uuid;
begin
  select project_id into target_project_id
  from public.issues where id = p_issue_id;
  if target_project_id is null then
    raise exception 'ISSUE_NOT_FOUND';
  end if;
  if not public.can_manage_project_tasks(target_project_id) then
    raise exception 'PROJECT_ISSUE_EDITOR_REQUIRED';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_label_ids, '{}'::uuid[])) requested(label_id)
    left join public.labels l
      on l.id = requested.label_id and l.project_id = target_project_id
    where l.id is null
  ) then
    raise exception 'ISSUE_LABELS_MUST_BELONG_TO_PROJECT';
  end if;
  delete from public.issue_labels where issue_id = p_issue_id;
  insert into public.issue_labels (issue_id, label_id)
  select p_issue_id, requested.label_id
  from unnest(coalesce(p_label_ids, '{}'::uuid[])) requested(label_id)
  on conflict (issue_id, label_id) do nothing;
end;
$$;
revoke all on function public.replace_issue_labels(uuid, uuid[]) from public, anon;
grant execute on function public.replace_issue_labels(uuid, uuid[]) to authenticated;

-- Activity records are written by trusted triggers, never directly by clients.
create or replace function public.record_project_activity(
  target_project_id uuid,
  target_action text,
  target_entity_type text,
  target_entity_id uuid,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_actor_id uuid := (select auth.uid());
  current_actor_name text;
begin
  if current_actor_id is null then return; end if;
  select coalesce(nullif(full_name, ''), email) into current_actor_name
  from public.users where id = current_actor_id;
  insert into public.activities
    (project_id, actor_id, action_type, entity_type, entity_id, metadata)
  values
    (target_project_id, current_actor_id, target_action, target_entity_type,
      target_entity_id, coalesce(target_metadata, '{}'::jsonb)
        || jsonb_build_object('actor_name', current_actor_name));
end;
$$;
revoke all on function public.record_project_activity(uuid, text, text, uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.log_project_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.record_project_activity(new.id, 'project.created', 'project', new.id,
    jsonb_build_object('name', new.name));
  return new;
end;
$$;
revoke all on function public.log_project_insert() from public, anon, authenticated;
drop trigger if exists log_project_insert on public.projects;
create trigger log_project_insert after insert on public.projects
  for each row execute function public.log_project_insert();

create or replace function public.log_project_member_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then
    perform public.record_project_activity(old.project_id, 'member.removed', 'member', old.user_id,
      jsonb_build_object('member_id', old.user_id, 'role', old.role));
    return old;
  end if;
  if tg_op = 'INSERT' then
    perform public.record_project_activity(new.project_id, 'member.added', 'member', new.user_id,
      jsonb_build_object('member_id', new.user_id, 'role', new.role));
  elsif new.role is distinct from old.role then
    perform public.record_project_activity(new.project_id, 'member.role_changed', 'member', new.user_id,
      jsonb_build_object('member_id', new.user_id, 'from_role', old.role, 'to_role', new.role));
  end if;
  return new;
end;
$$;
revoke all on function public.log_project_member_change() from public, anon, authenticated;
drop trigger if exists log_project_member_change on public.project_members;
create trigger log_project_member_change after insert or update or delete on public.project_members
  for each row execute function public.log_project_member_change();

create or replace function public.log_task_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.comments where commentable_type = 'task' and commentable_id = old.id;
  end if;
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'INSERT' then
    perform public.record_project_activity(new.project_id, 'task.created', 'task', new.id,
      jsonb_build_object('title', new.title, 'status', new.status));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.record_project_activity(old.project_id, 'task.deleted', 'task', old.id,
      jsonb_build_object('title', old.title));
    return old;
  end if;

  if new.status is distinct from old.status then
    perform public.record_project_activity(new.project_id, 'task.status_changed', 'task', new.id,
      jsonb_build_object('title', new.title, 'from_status', old.status, 'to_status', new.status));
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    perform public.record_project_activity(new.project_id, 'task.assigned', 'task', new.id,
      jsonb_build_object('title', new.title, 'from_assignee_id', old.assignee_id, 'to_assignee_id', new.assignee_id));
  end if;
  if new.title is distinct from old.title or new.priority is distinct from old.priority
      or new.description is distinct from old.description or new.due_date is distinct from old.due_date then
    perform public.record_project_activity(new.project_id, 'task.updated', 'task', new.id,
      jsonb_build_object('title', new.title));
  end if;
  return new;
end;
$$;
revoke all on function public.log_task_change() from public, anon, authenticated;
drop trigger if exists log_task_change on public.tasks;
create trigger log_task_change after insert or update or delete on public.tasks
  for each row execute function public.log_task_change();

create or replace function public.log_issue_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.comments where commentable_type = 'issue' and commentable_id = old.id;
  end if;
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'INSERT' then
    perform public.record_project_activity(new.project_id, 'issue.created', 'issue', new.id,
      jsonb_build_object('issue_number', new.issue_number, 'title', new.title, 'status', new.status));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.record_project_activity(old.project_id, 'issue.deleted', 'issue', old.id,
      jsonb_build_object('issue_number', old.issue_number, 'title', old.title));
    return old;
  end if;

  if new.status is distinct from old.status then
    perform public.record_project_activity(new.project_id, 'issue.status_changed', 'issue', new.id,
      jsonb_build_object('issue_number', new.issue_number, 'title', new.title, 'from_status', old.status, 'to_status', new.status));
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    perform public.record_project_activity(new.project_id, 'issue.assigned', 'issue', new.id,
      jsonb_build_object('issue_number', new.issue_number, 'title', new.title, 'to_assignee_id', new.assignee_id));
  end if;
  if new.title is distinct from old.title or new.priority is distinct from old.priority
      or new.description is distinct from old.description then
    perform public.record_project_activity(new.project_id, 'issue.updated', 'issue', new.id,
      jsonb_build_object('issue_number', new.issue_number, 'title', new.title));
  end if;
  return new;
end;
$$;
revoke all on function public.log_issue_change() from public, anon, authenticated;
drop trigger if exists log_issue_change on public.issues;
create trigger log_issue_change after insert or update or delete on public.issues
  for each row execute function public.log_issue_change();

create or replace function public.log_comment_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_project_id uuid;
  target_title text;
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.commentable_type = 'task' then
    select project_id, title into target_project_id, target_title
      from public.tasks where id = new.commentable_id;
  else
    select project_id, title into target_project_id, target_title
      from public.issues where id = new.commentable_id;
  end if;
  if tg_op = 'INSERT' then
    perform public.record_project_activity(target_project_id, 'comment.added', 'comment', new.id,
      jsonb_build_object('commentable_type', new.commentable_type,
        'commentable_id', new.commentable_id, 'target_title', target_title));
  elsif new.body is distinct from old.body then
    perform public.record_project_activity(target_project_id, 'comment.edited', 'comment', new.id,
      jsonb_build_object('commentable_type', new.commentable_type,
        'commentable_id', new.commentable_id, 'target_title', target_title));
  end if;
  return new;
end;
$$;
revoke all on function public.log_comment_change() from public, anon, authenticated;
drop trigger if exists log_comment_change on public.comments;
create trigger log_comment_change after insert or update on public.comments
  for each row execute function public.log_comment_change();
