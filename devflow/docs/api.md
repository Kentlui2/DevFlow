# DevFlow API

All successful responses use `{ "data": ... }`. Errors use `{ "error": { "message", "code", "issues?" } }`.

## Projects

| Method   | Route                      | Access         | Purpose                                                            |
| -------- | -------------------------- | -------------- | ------------------------------------------------------------------ |
| `GET`    | `/api/projects`            | Authenticated  | List projects the caller belongs to, including their project role. |
| `POST`   | `/api/projects`            | Authenticated  | Create a project and its initial owner membership atomically.      |
| `GET`    | `/api/projects/:projectId` | Project member | Read project details and caller role.                              |
| `PATCH`  | `/api/projects/:projectId` | Owner          | Update the project name or description.                            |
| `DELETE` | `/api/projects/:projectId` | Owner          | Delete the project and its dependent data.                         |

## Project members

| Method   | Route                                        | Access         | Purpose                                                            |
| -------- | -------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| `GET`    | `/api/projects/:projectId/members`           | Project member | List the member roster and roles.                                  |
| `POST`   | `/api/projects/:projectId/members`           | Owner          | Add an existing DevFlow account by email as a developer or viewer. |
| `PATCH`  | `/api/projects/:projectId/members/:memberId` | Owner          | Change a non-owner member’s role.                                  |
| `DELETE` | `/api/projects/:projectId/members/:memberId` | Owner          | Remove a non-owner member.                                         |

## Tasks

| Method   | Route                                    | Access             | Purpose                                                                                                                                     |
| -------- | ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/projects/:projectId/tasks`         | Project member     | List tasks; optional `status`, `priority`, `assigneeId`, `labelId`, and `search` filters. Use `assigneeId=unassigned` for unassigned tasks. |
| `POST`   | `/api/projects/:projectId/tasks`         | Owner or developer | Create a task with optional assignee, due date, priority, status, and label IDs.                                                            |
| `GET`    | `/api/projects/:projectId/tasks/:taskId` | Project member     | Read one task with assignee and labels.                                                                                                     |
| `PATCH`  | `/api/projects/:projectId/tasks/:taskId` | Owner or developer | Update task fields or workflow status.                                                                                                      |
| `DELETE` | `/api/projects/:projectId/tasks/:taskId` | Owner or developer | Delete a task and its label links.                                                                                                          |

## Task labels

| Method   | Route                                      | Access             | Purpose                                                                              |
| -------- | ------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------ |
| `GET`    | `/api/projects/:projectId/labels`          | Project member     | List labels for a project.                                                           |
| `POST`   | `/api/projects/:projectId/labels`          | Owner or developer | Create a project label with a name and hex color. Names are unique within a project. |
| `DELETE` | `/api/projects/:projectId/labels/:labelId` | Owner or developer | Delete a label and detach it from tasks.                                             |

## Issues

| Method   | Route                                      | Access             | Purpose                                                                                    |
| -------- | ------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------ |
| `GET`    | `/api/projects/:projectId/issues`          | Project member     | List issues; optional `status`, `priority`, `assigneeId`, `labelId`, and `search` filters. |
| `POST`   | `/api/projects/:projectId/issues`          | Owner or developer | Create an issue with an optional assignee and project labels.                              |
| `GET`    | `/api/projects/:projectId/issues/:issueId` | Project member     | Read an issue with its assignee and labels.                                                |
| `PATCH`  | `/api/projects/:projectId/issues/:issueId` | Owner or developer | Update issue fields, status, assignee, priority, or labels.                                |
| `DELETE` | `/api/projects/:projectId/issues/:issueId` | Owner or developer | Delete an issue and its comments and labels.                                               |

Issue statuses are `open`, `in_progress`, `resolved`, and `closed`. The database generates issue numbers.

## Comments

| Method   | Route                                                                      | Access             | Purpose                                                                      |
| -------- | -------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `GET`    | `/api/projects/:projectId/comments?commentableType=task&commentableId=:id` | Project member     | List comments for a task or issue. Use `commentableType=issue` for an issue. |
| `POST`   | `/api/projects/:projectId/comments`                                        | Owner or developer | Add a comment with `{ commentableType, commentableId, body }`.               |
| `PATCH`  | `/api/projects/:projectId/comments/:commentId`                             | Comment author     | Edit an authored comment.                                                    |
| `DELETE` | `/api/projects/:projectId/comments/:commentId`                             | Comment author     | Delete an authored comment.                                                  |

## Activity

| Method | Route                               | Access         | Purpose                                      |
| ------ | ----------------------------------- | -------------- | -------------------------------------------- |
| `GET`  | `/api/projects/:projectId/activity` | Project member | Read the latest 60 project activity records. |

Database triggers record project, member, task, issue, sprint, and comment changes. Clients cannot insert or edit activity records directly.

## Sprints and backlog

| Method   | Route                                                      | Access         | Purpose                                                                  |
| -------- | ---------------------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| `GET`    | `/api/projects/:projectId/sprints`                         | Project member | List sprints with their tasks and progress inputs.                       |
| `POST`   | `/api/projects/:projectId/sprints`                         | Owner          | Create a planned sprint with a name and date range.                      |
| `PATCH`  | `/api/projects/:projectId/sprints/:sprintId`               | Owner          | Edit a planned sprint, start it, or complete an active sprint.           |
| `DELETE` | `/api/projects/:projectId/sprints/:sprintId`               | Owner          | Delete a sprint and return its tasks to the backlog.                     |
| `POST`   | `/api/projects/:projectId/sprints/:sprintId/tasks`         | Owner          | Add one or more unscheduled project tasks to a planned or active sprint. |
| `DELETE` | `/api/projects/:projectId/sprints/:sprintId/tasks/:taskId` | Owner          | Remove a task from a planned or active sprint.                           |

The project backlog is `/projects/:projectId/backlog`; it lists tasks without a sprint assignment and supports search and status, priority, assignee, and label filters. Task list APIs also accept `sprintId` (a sprint UUID or `unassigned`) to filter by sprint membership.

Only one sprint can be active per project. Sprint status moves from `planned` to `active` to `completed`; dates are locked once a sprint starts. Project members can view sprint plans, while only owners can change sprint configuration or task assignments.

## Analytics

Project analytics are rendered server-side at `/projects/:projectId/analytics` for all project members. Metrics are calculated from the caller's RLS-scoped task, issue, sprint, sprint-task, member, and activity records; there is no separate analytics write API. Sprint velocity counts completed tasks (not story points), and workload includes active, in-progress, and completed task counts for each current member.

## Phase 9 integrations

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` / `POST` | `/api/projects/:projectId/github` | Member / owner | List connected repositories and recent GitHub activity; connect or disconnect a repository. |
| `GET` / `POST` / `DELETE` | `/api/projects/:projectId/tasks/:taskId/github-links` | Member / editor | Read, attach, or remove a commit, pull request, or issue reference on a task. |
| `GET` / `POST` | `/api/projects/:projectId/attachments` | Member / editor | List signed download links for an item or upload a file (10 MB maximum). `targetType` is `task`, `issue`, or `comment`. |
| `DELETE` | `/api/projects/:projectId/attachments/:attachmentId` | Uploader/editor | Remove an attachment and its private object. |
| `GET` / `PATCH` | `/api/notifications` | Signed-in user | Read the latest 50 notifications; mark unread notifications read (`PATCH` body: `{ "ids": [] }` for all unread or a list of IDs). |
| `GET` | `/api/projects/:projectId/github/connect` | Project owner | Start the GitHub App install and user authorization flow. |
| `GET` | `/api/integrations/github/setup` | GitHub redirect | Bind the returned installation ID to the initiating project and continue OAuth authorization. |
| `GET` | `/api/integrations/github/callback` | GitHub redirect | Verify the user can access the installation, then sync the repositories granted to the App. |

GitHub activity uses GitHub's REST API. Public repositories can be linked by URL. Private repositories require a project owner to install the public DevFlow GitHub App for an account or organization and select repository access. DevFlow verifies the installation against the signed-in GitHub user, stores installation/repository identifiers, and mints short-lived tokens scoped to one repository per activity request. Live changes use Supabase Realtime subscriptions on the `activities`, `comments`, and `notifications` tables and remain subject to RLS. Apply `0007_github_app_installations.sql` and configure the server-only GitHub App credentials described in the README before enabling this flow.

Request bodies are validated with Zod. Route handlers authenticate and authorize the request before calling the service layer. Supabase RLS repeats project and role checks independently. Task assignees and task labels must belong to the same project. Owners cannot be removed or demoted through the member endpoints.
Issue assignees and labels must belong to the same project. Viewers can read issues, comments, and activity but cannot write; comments can only be edited or deleted by their author.

## Error codes

- `UNAUTHENTICATED` — no valid Supabase user session.
- `NOT_FOUND` — project or membership is unavailable to the caller.
- `FORBIDDEN` — caller is a project member but lacks the required owner role.
- `VALIDATION_ERROR` — body fields failed schema validation.
- `MEMBER_NOT_FOUND` — the provided email does not match an existing DevFlow account.
- `ALREADY_MEMBER` — the account is already part of the project.
- `INVALID_ASSIGNEE` — the selected task or issue assignee is not a project member.
- `INVALID_LABELS` — one or more selected labels do not belong to the project.
