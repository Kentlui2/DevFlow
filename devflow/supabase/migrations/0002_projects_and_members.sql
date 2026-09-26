-- Phase 4: project and member access. The security-definer helpers avoid
-- recursive RLS checks when policies need to inspect project membership.

create or replace function public.is_project_member(target_project_id uuid)
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
  );
$$;

create or replace function public.is_project_owner(target_project_id uuid)
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
      and pm.role = 'owner'
  );
$$;

revoke all on function public.is_project_member(uuid) from public, anon;
revoke all on function public.is_project_owner(uuid) from public, anon;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid) to authenticated;

-- Repair any projects created before project creation also created its owner row.
update public.project_members pm
set role = 'developer'
from public.projects p
where pm.project_id = p.id
  and pm.role = 'owner'
  and pm.user_id <> p.owner_id;

insert into public.project_members (project_id, user_id, role)
select p.id, p.owner_id, 'owner'
from public.projects p
on conflict (project_id, user_id) do update set role = 'owner';

alter table public.users enable row level security;
create index if not exists idx_users_email_lower on public.users (lower(email));

drop policy if exists "Members can view their projects" on public.projects;
drop policy if exists "Owners can update their projects" on public.projects;
drop policy if exists "Owners can delete their projects" on public.projects;
drop policy if exists "Authenticated users can create projects" on public.projects;

create policy "Project members can view projects"
  on public.projects for select to authenticated
  using (public.is_project_member(id));

create policy "Project owners can update projects"
  on public.projects for update to authenticated
  using (public.is_project_owner(id))
  with check (public.is_project_owner(id) and owner_id = (select auth.uid()));

create policy "Project owners can delete projects"
  on public.projects for delete to authenticated
  using (public.is_project_owner(id));

drop policy if exists "Members can view project membership" on public.project_members;

create policy "Project members can view membership"
  on public.project_members for select to authenticated
  using (public.is_project_member(project_id));

create policy "Project owners can add developers and viewers"
  on public.project_members for insert to authenticated
  with check (
    role in ('developer', 'viewer')
    and public.is_project_owner(project_id)
  );

create policy "Project owners can update member roles"
  on public.project_members for update to authenticated
  using (
    role <> 'owner'
    and public.is_project_owner(project_id)
  )
  with check (
    role in ('developer', 'viewer')
    and public.is_project_owner(project_id)
  );

create policy "Project owners can remove non-owner members"
  on public.project_members for delete to authenticated
  using (
    role <> 'owner'
    and public.is_project_owner(project_id)
  );

create or replace function public.prevent_project_member_identity_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id <> old.id or new.project_id <> old.project_id or new.user_id <> old.user_id then
    raise exception 'PROJECT_MEMBERSHIP_IDENTITY_IS_IMMUTABLE';
  end if;
  if old.role = 'owner' and new.role <> 'owner' then
    raise exception 'PROJECT_OWNER_ROLE_IS_IMMUTABLE';
  end if;
  if new.role not in ('owner', 'developer', 'viewer') then
    raise exception 'INVALID_MEMBER_ROLE';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_project_member_identity_change() from public, anon, authenticated;

drop trigger if exists prevent_project_member_identity_change on public.project_members;
create trigger prevent_project_member_identity_change
  before update on public.project_members
  for each row execute function public.prevent_project_member_identity_change();

drop policy if exists "Members can view project tasks" on public.tasks;
drop policy if exists "Owners and developers can manage tasks" on public.tasks;

create policy "Project members can view tasks"
  on public.tasks for select to authenticated
  using (public.is_project_member(project_id));

create policy "Owners and developers can manage tasks"
  on public.tasks for all to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = tasks.project_id
        and pm.user_id = (select auth.uid())
        and pm.role in ('owner', 'developer')
    )
  )
  with check (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = tasks.project_id
        and pm.user_id = (select auth.uid())
        and pm.role in ('owner', 'developer')
    )
  );

drop policy if exists "Project members can view activity" on public.activities;
create policy "Project members can view activity"
  on public.activities for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "Users can view themselves and project teammates" on public.users;
create policy "Users can view themselves and project teammates"
  on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.project_members own_membership
      join public.project_members teammate
        on teammate.project_id = own_membership.project_id
      where own_membership.user_id = (select auth.uid())
        and teammate.user_id = users.id
    )
  );

-- Project creation and the initial owner membership must be atomic.
create or replace function public.create_project(p_name text, p_description text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_project public.projects;
begin
  if current_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 80 then
    raise exception 'INVALID_PROJECT_NAME';
  end if;
  if p_description is not null and length(btrim(p_description)) > 500 then
    raise exception 'INVALID_PROJECT_DESCRIPTION';
  end if;

  insert into public.projects (name, description, owner_id)
  values (btrim(p_name), nullif(btrim(p_description), ''), current_user_id)
  returning * into created_project;

  insert into public.project_members (project_id, user_id, role)
  values (created_project.id, current_user_id, 'owner');

  return to_jsonb(created_project);
end;
$$;

revoke all on function public.create_project(text, text) from public, anon;
grant execute on function public.create_project(text, text) to authenticated;

-- Email lookup and membership insert happen in one owner-authorized function.
create or replace function public.add_project_member_by_email(
  p_project_id uuid,
  p_email text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_user public.users;
  created_membership public.project_members;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not public.is_project_owner(p_project_id) then
    raise exception 'PROJECT_OWNER_REQUIRED';
  end if;
  if p_role not in ('developer', 'viewer') then
    raise exception 'INVALID_MEMBER_ROLE';
  end if;
  if p_email is null or length(btrim(p_email)) > 254 then
    raise exception 'INVALID_MEMBER_EMAIL';
  end if;

  select * into target_user
  from public.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if target_user.id is null then
    raise exception 'MEMBER_ACCOUNT_NOT_FOUND';
  end if;
  if target_user.id = (select auth.uid()) then
    raise exception 'CANNOT_ADD_SELF';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (p_project_id, target_user.id, p_role)
  on conflict (project_id, user_id) do nothing
  returning * into created_membership;

  if created_membership.id is null then
    raise exception 'MEMBER_ALREADY_EXISTS';
  end if;

  return jsonb_build_object(
    'id', created_membership.id,
    'project_id', created_membership.project_id,
    'user_id', created_membership.user_id,
    'role', created_membership.role,
    'joined_at', created_membership.joined_at,
    'email', target_user.email,
    'full_name', target_user.full_name
  );
end;
$$;

revoke all on function public.add_project_member_by_email(uuid, text, text) from public, anon;
grant execute on function public.add_project_member_by_email(uuid, text, text) to authenticated;
