-- Phase 9: notifications, GitHub references, private attachments, and realtime.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications(user_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists "Users can view their notifications" on public.notifications;
create policy "Users can view their notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users can mark their notifications read" on public.notifications;
create policy "Users can mark their notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.guard_notification_update()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.id <> old.id or new.project_id <> old.project_id or new.user_id <> old.user_id
    or new.actor_id is distinct from old.actor_id or new.event_type <> old.event_type
    or new.entity_type <> old.entity_type or new.entity_id <> old.entity_id
    or new.title <> old.title or new.body <> old.body or new.created_at <> old.created_at then
    raise exception 'NOTIFICATION_CONTENT_IS_IMMUTABLE';
  end if;
  return new;
end; $$;
revoke all on function public.guard_notification_update() from public, anon, authenticated;
drop trigger if exists guard_notification_update on public.notifications;
create trigger guard_notification_update before update on public.notifications
  for each row execute function public.guard_notification_update();

create or replace function public.create_project_notification(
  recipient_id uuid, target_project_id uuid, target_actor_id uuid,
  target_event text, target_entity text, target_entity_id uuid,
  target_title text, target_body text default ''
) returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if recipient_id is null or recipient_id = target_actor_id then return; end if;
  if not exists (select 1 from public.project_members pm
    where pm.project_id = target_project_id and pm.user_id = recipient_id) then return; end if;
  insert into public.notifications(project_id, user_id, actor_id, event_type,
    entity_type, entity_id, title, body)
  values (target_project_id, recipient_id, target_actor_id, target_event,
    target_entity, target_entity_id, left(target_title, 180), left(coalesce(target_body, ''), 500));
end; $$;
revoke all on function public.create_project_notification(uuid, uuid, uuid, text, text, uuid, text, text)
  from public, anon, authenticated;

create or replace function public.notify_task_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.create_project_notification(new.assignee_id, new.project_id, auth.uid(),
      'task.assigned', 'task', new.id, 'You were assigned a task', new.title);
  end if;
  return new;
end; $$;
revoke all on function public.notify_task_assignment() from public, anon, authenticated;
drop trigger if exists notify_task_assignment on public.tasks;
create trigger notify_task_assignment after insert or update on public.tasks
  for each row execute function public.notify_task_assignment();

create or replace function public.notify_issue_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.create_project_notification(new.assignee_id, new.project_id, auth.uid(),
      'issue.assigned', 'issue', new.id, 'You were assigned an issue', new.title);
  end if;
  return new;
end; $$;
revoke all on function public.notify_issue_assignment() from public, anon, authenticated;
drop trigger if exists notify_issue_assignment on public.issues;
create trigger notify_issue_assignment after insert or update on public.issues
  for each row execute function public.notify_issue_assignment();

create or replace function public.notify_comment_added()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target_project uuid; target_assignee uuid; target_creator uuid; target_title text; mention_row record;
begin
  if new.commentable_type = 'task' then
    select project_id, assignee_id, created_by, title into target_project, target_assignee, target_creator, target_title
      from public.tasks where id = new.commentable_id;
  elsif new.commentable_type = 'issue' then
    select project_id, assignee_id, created_by, title into target_project, target_assignee, target_creator, target_title
      from public.issues where id = new.commentable_id;
  end if;
  perform public.create_project_notification(target_assignee, target_project, new.author_id,
    'comment.added', new.commentable_type, new.commentable_id,
    'New comment on ' || coalesce(target_title, 'your work'), left(new.body, 180));
  if target_creator is distinct from target_assignee then
    perform public.create_project_notification(target_creator, target_project, new.author_id,
      'comment.added', new.commentable_type, new.commentable_id,
      'New comment on work you created', left(new.body, 180));
  end if;
  for mention_row in select id from public.users
    where id <> new.author_id and id is distinct from target_assignee
      and id is distinct from target_creator and position('@' || lower(email) in lower(new.body)) > 0
  loop
    perform public.create_project_notification(mention_row.id, target_project, new.author_id,
      'comment.mentioned', new.commentable_type, new.commentable_id,
      'You were mentioned in a comment', left(new.body, 180));
  end loop;
  return new;
end; $$;
revoke all on function public.notify_comment_added() from public, anon, authenticated;
drop trigger if exists notify_comment_added on public.comments;
create trigger notify_comment_added after insert on public.comments
  for each row execute function public.notify_comment_added();

create or replace function public.notify_sprint_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare member_row record; event_name text;
begin
  if new.status is distinct from old.status and new.status in ('active', 'completed') then
    event_name := case when new.status = 'active' then 'sprint.started' else 'sprint.completed' end;
    for member_row in select user_id from public.project_members where project_id = new.project_id loop
      perform public.create_project_notification(member_row.user_id, new.project_id, auth.uid(),
        event_name, 'sprint', new.id,
        case when new.status = 'active' then 'Sprint started' else 'Sprint completed' end,
        new.name);
    end loop;
  end if;
  return new;
end; $$;
revoke all on function public.notify_sprint_status() from public, anon, authenticated;
drop trigger if exists notify_sprint_status on public.sprints;
create trigger notify_sprint_status after update of status on public.sprints
  for each row execute function public.notify_sprint_status();

create table if not exists public.github_repositories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner text not null,
  repo text not null,
  html_url text not null,
  linked_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique(project_id, owner, repo)
);
create table if not exists public.task_github_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  repository_id uuid not null references public.github_repositories(id) on delete cascade,
  link_type text not null check(link_type in ('commit', 'pull_request', 'issue')),
  reference text not null,
  html_url text not null,
  title text not null,
  linked_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique(task_id, html_url)
);
alter table public.github_repositories enable row level security;
alter table public.task_github_links enable row level security;
drop policy if exists "Project members can view linked repositories" on public.github_repositories;
create policy "Project members can view linked repositories" on public.github_repositories
  for select to authenticated using (public.is_project_member(project_id));
drop policy if exists "Project owners manage linked repositories" on public.github_repositories;
create policy "Project owners manage linked repositories" on public.github_repositories
  for all to authenticated using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id) and linked_by = (select auth.uid()));
drop policy if exists "Project members can view GitHub task links" on public.task_github_links;
create policy "Project members can view GitHub task links" on public.task_github_links
  for select to authenticated using (public.is_project_member(project_id));
drop policy if exists "Project editors manage GitHub task links" on public.task_github_links;
create policy "Project editors manage GitHub task links" on public.task_github_links
  for all to authenticated using (public.can_manage_project_tasks(project_id))
  with check (public.can_manage_project_tasks(project_id) and linked_by = (select auth.uid()));

create or replace function public.validate_task_github_link()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.tasks t where t.id = new.task_id and t.project_id = new.project_id)
    or not exists (select 1 from public.github_repositories r where r.id = new.repository_id and r.project_id = new.project_id) then
    raise exception 'GITHUB_LINK_TARGETS_MUST_BELONG_TO_PROJECT';
  end if;
  return new;
end; $$;
revoke all on function public.validate_task_github_link() from public, anon, authenticated;
drop trigger if exists validate_task_github_link on public.task_github_links;
create trigger validate_task_github_link before insert or update on public.task_github_links
  for each row execute function public.validate_task_github_link();

create or replace function public.notify_github_pr_linked()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare task_row record;
begin
  if new.link_type = 'pull_request' then
    select created_by, assignee_id, title into task_row from public.tasks where id = new.task_id;
    perform public.create_project_notification(task_row.assignee_id, new.project_id, auth.uid(),
      'pull_request.linked', 'task', new.task_id, 'Pull request linked to your task', new.title);
    if task_row.created_by is distinct from task_row.assignee_id then
      perform public.create_project_notification(task_row.created_by, new.project_id, auth.uid(),
        'pull_request.linked', 'task', new.task_id, 'Pull request linked to a task', new.title);
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.notify_github_pr_linked() from public, anon, authenticated;
drop trigger if exists notify_github_pr_linked on public.task_github_links;
create trigger notify_github_pr_linked after insert on public.task_github_links
  for each row execute function public.notify_github_pr_linked();

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  target_type text not null check(target_type in ('task', 'issue', 'comment')),
  target_id uuid not null,
  uploaded_by uuid not null references public.users(id),
  file_name text not null,
  storage_path text not null unique,
  content_type text not null,
  file_size bigint not null check(file_size > 0 and file_size <= 10485760),
  created_at timestamptz not null default now()
);

create or replace function public.attachment_target_in_project(
  target_type text, target_id uuid, target_project_id uuid
) returns boolean language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if target_type in ('task', 'issue') then
    return public.comment_target_in_project(target_type, target_id, target_project_id);
  elsif target_type = 'comment' then
    return exists (
      select 1 from public.comments c
      where c.id = target_id and (
        (c.commentable_type = 'task' and exists(select 1 from public.tasks t where t.id = c.commentable_id and t.project_id = target_project_id))
        or (c.commentable_type = 'issue' and exists(select 1 from public.issues i where i.id = c.commentable_id and i.project_id = target_project_id))
      )
    );
  end if;
  return false;
end; $$;
revoke all on function public.attachment_target_in_project(text, uuid, uuid) from public, anon;
grant execute on function public.attachment_target_in_project(text, uuid, uuid) to authenticated;

create or replace function public.validate_attachment_target()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.attachment_target_in_project(new.target_type, new.target_id, new.project_id) then
    raise exception 'ATTACHMENT_TARGET_NOT_FOUND';
  end if;
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.target_type <> old.target_type
    or new.target_id <> old.target_id or new.storage_path <> old.storage_path
    or new.uploaded_by <> old.uploaded_by) then
    raise exception 'ATTACHMENT_IDENTITY_IS_IMMUTABLE';
  end if;
  return new;
end; $$;
revoke all on function public.validate_attachment_target() from public, anon, authenticated;
drop trigger if exists validate_attachment_target on public.attachments;
create trigger validate_attachment_target before insert or update on public.attachments
  for each row execute function public.validate_attachment_target();

alter table public.attachments enable row level security;
drop policy if exists "Project members can view attachments" on public.attachments;
create policy "Project members can view attachments" on public.attachments
  for select to authenticated using (public.is_project_member(project_id));
drop policy if exists "Project editors can add attachments" on public.attachments;
create policy "Project editors can add attachments" on public.attachments
  for insert to authenticated with check (
    uploaded_by = (select auth.uid())
    and public.can_manage_project_tasks(project_id)
    and public.attachment_target_in_project(target_type, target_id, project_id)
  );
drop policy if exists "Uploader or project owner can delete attachments" on public.attachments;
drop policy if exists "Project editors can delete attachments" on public.attachments;
create policy "Project editors can delete attachments" on public.attachments
  for delete to authenticated using (public.can_manage_project_tasks(project_id));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('devflow-attachments', 'devflow-attachments', false, 10485760,
  array['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain','text/markdown','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Project editors upload attachments" on storage.objects;
create policy "Project editors upload attachments" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'devflow-attachments'
    and (storage.foldername(name))[1] is not null
    and public.can_manage_project_tasks(((storage.foldername(name))[1])::uuid)
  );
drop policy if exists "Project members read attachments" on storage.objects;
create policy "Project members read attachments" on storage.objects
  for select to authenticated using (
    bucket_id = 'devflow-attachments'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );
drop policy if exists "Project editors delete attachments" on storage.objects;
create policy "Project editors delete attachments" on storage.objects
  for delete to authenticated using (
    bucket_id = 'devflow-attachments'
    and public.can_manage_project_tasks(((storage.foldername(name))[1])::uuid)
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.activities; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.issues; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.sprints; exception when duplicate_object then null; end;
  end if;
end $$;
