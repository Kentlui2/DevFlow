# DevFlow API

All successful responses use `{ "data": ... }`. Errors use `{ "error": { "message", "code", "issues?" } }`.

## Projects

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/projects` | Authenticated | List projects the caller belongs to, including their project role. |
| `POST` | `/api/projects` | Authenticated | Create a project and its initial owner membership atomically. |
| `GET` | `/api/projects/:projectId` | Project member | Read project details and caller role. |
| `PATCH` | `/api/projects/:projectId` | Owner | Update the project name or description. |
| `DELETE` | `/api/projects/:projectId` | Owner | Delete the project and its dependent data. |

## Project members

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/members` | Project member | List the member roster and roles. |
| `POST` | `/api/projects/:projectId/members` | Owner | Add an existing DevFlow account by email as a developer or viewer. |
| `PATCH` | `/api/projects/:projectId/members/:memberId` | Owner | Change a non-owner member’s role. |
| `DELETE` | `/api/projects/:projectId/members/:memberId` | Owner | Remove a non-owner member. |

## Tasks

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/tasks` | Project member | List tasks; optional `status`, `priority`, `assigneeId`, `labelId`, and `search` filters. Use `assigneeId=unassigned` for unassigned tasks. |
| `POST` | `/api/projects/:projectId/tasks` | Owner or developer | Create a task with optional assignee, due date, priority, status, and label IDs. |
| `GET` | `/api/projects/:projectId/tasks/:taskId` | Project member | Read one task with assignee and labels. |
| `PATCH` | `/api/projects/:projectId/tasks/:taskId` | Owner or developer | Update task fields or workflow status. |
| `DELETE` | `/api/projects/:projectId/tasks/:taskId` | Owner or developer | Delete a task and its label links. |

## Task labels

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/labels` | Project member | List labels for a project. |
| `POST` | `/api/projects/:projectId/labels` | Owner or developer | Create a project label with a name and hex color. Names are unique within a project. |
| `DELETE` | `/api/projects/:projectId/labels/:labelId` | Owner or developer | Delete a label and detach it from tasks. |

Request bodies are validated with Zod. Route handlers authenticate and authorize the request before calling the service layer. Supabase RLS repeats project and role checks independently. Task assignees and task labels must belong to the same project. Owners cannot be removed or demoted through the member endpoints.

## Error codes

- `UNAUTHENTICATED` — no valid Supabase user session.
- `NOT_FOUND` — project or membership is unavailable to the caller.
- `FORBIDDEN` — caller is a project member but lacks the required owner role.
- `VALIDATION_ERROR` — body fields failed schema validation.
- `MEMBER_NOT_FOUND` — the provided email does not match an existing DevFlow account.
- `ALREADY_MEMBER` — the account is already part of the project.
