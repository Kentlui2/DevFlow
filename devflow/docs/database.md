# DevFlow — Database Design

## Stack

Supabase Postgres. `auth.users` (managed by Supabase Auth) holds credentials; a `public.users` table mirrors the profile fields the app needs, kept in sync via a trigger on `auth.users` insert.

## ERD

```mermaid
erDiagram
    USERS ||--o{ PROJECT_MEMBERS : has
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ PROJECT_MEMBERS : has
    PROJECTS ||--o{ TASKS : contains
    PROJECTS ||--o{ ISSUES : contains
    PROJECTS ||--o{ LABELS : defines
    PROJECTS ||--o{ SPRINTS : contains
    PROJECTS ||--o{ ACTIVITIES : logs
    USERS ||--o{ TASKS : assigned_to
    USERS ||--o{ ISSUES : assigned_to
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ ACTIVITIES : performs
    TASKS ||--o{ COMMENTS : has
    ISSUES ||--o{ COMMENTS : has
    TASKS }o--o{ LABELS : tagged_with
    ISSUES }o--o{ LABELS : tagged_with
    ISSUES ||--o{ ISSUE_LABELS : labeled
    LABELS ||--o{ ISSUE_LABELS : used_by
    SPRINTS }o--o{ TASKS : includes

    USERS {
        uuid id PK
        text email
        text full_name
        text avatar_url
        timestamptz created_at
    }
    PROJECTS {
        uuid id PK
        text name
        text description
        uuid owner_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    PROJECT_MEMBERS {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        text role "owner | developer | viewer"
        timestamptz joined_at
    }
    TASKS {
        uuid id PK
        uuid project_id FK
        text title
        text description
        text status "backlog|todo|in_progress|in_review|done"
        text priority "low|medium|high|urgent"
        uuid assignee_id FK
        uuid created_by FK
        date due_date
        timestamptz created_at
        timestamptz updated_at
    }
    LABELS {
        uuid id PK
        uuid project_id FK
        text name
        text color
    }
    TASK_LABELS {
        uuid task_id FK
        uuid label_id FK
    }
    ISSUES {
        uuid id PK
        bigint issue_number UK
        uuid project_id FK
        text title
        text description
        text status "open|in_progress|resolved|closed"
        text priority "low|medium|high|urgent"
        uuid assignee_id FK
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    ISSUE_LABELS {
        uuid issue_id FK
        uuid label_id FK
    }
    COMMENTS {
        uuid id PK
        uuid author_id FK
        text author_name
        text commentable_type "task | issue"
        uuid commentable_id
        text body
        timestamptz created_at
        timestamptz updated_at
    }
    SPRINTS {
        uuid id PK
        uuid project_id FK
        text name
        date start_date
        date end_date
        text status "planned|active|completed"
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    SPRINT_TASKS {
        uuid sprint_id FK
        uuid task_id FK UK
        timestamptz added_at
    }
    ACTIVITIES {
        uuid id PK
        uuid project_id FK
        uuid actor_id FK
        text action_type
        text entity_type
        uuid entity_id
        jsonb metadata
        timestamptz created_at
    }
```

## Table notes

**users** — `id` matches `auth.users.id` (1:1). Populated by a Postgres trigger (`handle_new_user`) on signup so the app never writes directly to `auth.users`.

**project_members** — join table carrying `role`. Unique constraint on `(project_id, user_id)`. This table is the single source of truth for authorization — every permission check joins through it.

**tasks / issues** — kept as separate tables rather than a shared `polymorphic type` table. They have different lifecycles (issues get post-MVP fields like resolution notes later) and separate tables keep queries and RLS policies simpler, at the cost of some duplication between the two.

**comments** — polymorphic via `commentable_type` + `commentable_id` rather than two separate comment tables, since comments behave identically on tasks and issues and a shared activity/notification pipeline benefits from one table. A database trigger validates that each target exists in the same project because Postgres can't add a foreign key to a polymorphic target. `author_name` preserves the display name in existing discussion after a member leaves a project.

**activities** — append-only audit log. Database triggers record project, member, task, issue, sprint, and comment changes. `metadata` (jsonb) holds action-specific detail (e.g. `{"from_status": "todo", "to_status": "in_progress"}`) so the schema doesn't need to change as new activity types are added. Clients can read activity but cannot write it directly.

**sprint_tasks** — associates a task with one sprint at a time. A task can be returned to the backlog and rescheduled by removing its sprint link. Completed sprint assignments stay attached as history.

## Row-Level Security (defense in depth)

The PRD is explicit: _"Never rely on the frontend alone to enforce permissions."_ The API layer (Route Handlers / Server Actions) is the primary enforcement point — every write checks `project_members.role` before touching data. RLS policies are added as a second, independent layer directly in Postgres, so a bug in the API layer doesn't expose data:

- `projects`: `SELECT` allowed to members of the project; `UPDATE`/`DELETE` restricted to `role = 'owner'`.
- `tasks`, `issues`, `comments`: `SELECT` allowed to project members; issue/comment writes require an owner or developer, and only the comment author can edit or delete a comment.
- `activities`: `INSERT` only via a `SECURITY DEFINER` function (never direct client insert, so the log can't be forged); `SELECT` allowed to project members.

### Phase 4 policy implementation

Migration `0002_projects_and_members.sql` adds security-definer membership helpers so project and task RLS checks do not recursively query the `project_members` policy. It also:

- Restricts project reads to members and project updates/deletes to owners.
- Allows member roster reads within a shared project; owners can add registered users as developers/viewers, change those roles, and remove non-owners.
- Prevents a project member row from being reassigned to another project or user, and keeps the owner role immutable.
- Creates a project and its initial owner membership atomically through `create_project`.
- Adds a scoped `users` read policy so members can see teammate profile details but not unrelated users.
- Allows project members to read the activity feed.

The add-member flow accepts an email for an existing DevFlow account. Sending invitations to people who have not registered requires a separate email invitation service and is not included in this phase.

### Phase 5 policy implementation

Migration `0003_task_management.sql` enables RLS on `labels` and `task_labels`. Project members can read labels; owners and developers can create labels and attach/detach labels from tasks. A database trigger prevents assigning a task to someone outside its project and keeps a task's project and creator immutable. Label names are unique within a project, ignoring case.

### Phase 6 policy implementation

Migration `0004_collaboration.sql` adds issues and issue-label links, completes RLS for issue and comment access, validates polymorphic comment targets, and provides an atomic issue-label replacement function. Owners and developers can manage issues and post comments; only comment authors can edit or delete their comments. Viewers can read issues, comments, and activity. Database triggers append project, membership, task, issue, and comment changes to the activity feed.

### Phase 7 policy implementation

Migration `0005_sprint_management.sql` creates sprints and task assignments. Project members can read sprint plans; only project owners can create, update, delete, or assign sprint tasks. Database constraints enforce valid date ranges, a single active sprint per project, one sprint per task, and same-project task assignment. Trigger-based activity records capture sprint lifecycle and task planning changes.

## Indexes worth adding early

- `project_members(project_id, user_id)` — unique, and the hot path for every authorization check.
- `tasks(project_id, status)` — Kanban board query.
- `tasks(assignee_id)` — "my tasks" dashboard query.
- `sprints(project_id, status, start_date, end_date)` — project sprint lists and active sprint lookup.
- `sprint_tasks(task_id, sprint_id)` — task-to-sprint filtering and backlog exclusion.
- `activities(project_id, created_at DESC)` — activity feed pagination.
