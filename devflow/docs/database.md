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
        timestamptz created_at
    }
    SPRINT_TASKS {
        uuid sprint_id FK
        uuid task_id FK
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

**comments** — polymorphic via `commentable_type` + `commentable_id` rather than two separate comment tables, since comments behave identically on tasks and issues and a shared activity/notification pipeline benefits from one table. Enforce referential integrity at the application layer (Postgres can't FK a polymorphic column) and add a `CHECK` constraint on `commentable_type`.

**activities** — append-only audit log. `metadata` (jsonb) holds action-specific detail (e.g. `{"from_status": "todo", "to_status": "in_progress"}`) so the schema doesn't need to change as new activity types are added.

**sprint_tasks** — join table; a task can only belong to one _active_ sprint at a time (enforced at the application layer, not the DB, since "active" depends on sprint status).

## Row-Level Security (defense in depth)

The PRD is explicit: _"Never rely on the frontend alone to enforce permissions."_ The API layer (Route Handlers / Server Actions) is the primary enforcement point — every write checks `project_members.role` before touching data. RLS policies are added as a second, independent layer directly in Postgres, so a bug in the API layer doesn't expose data:

- `projects`: `SELECT` allowed to members of the project; `UPDATE`/`DELETE` restricted to `role = 'owner'`.
- `tasks`, `issues`, `comments`: `SELECT` allowed to project members; `INSERT`/`UPDATE` restricted to `role IN ('owner', 'developer')`.
- `activities`: `INSERT` only via a `SECURITY DEFINER` function (never direct client insert, so the log can't be forged); `SELECT` allowed to project members.

## Indexes worth adding early

- `project_members(project_id, user_id)` — unique, and the hot path for every authorization check.
- `tasks(project_id, status)` — Kanban board query.
- `tasks(assignee_id)` — "my tasks" dashboard query.
- `activities(project_id, created_at DESC)` — activity feed pagination.
