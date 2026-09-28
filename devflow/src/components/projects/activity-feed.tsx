import Link from "next/link";
import type { ProjectActivity } from "@/lib/types/collaboration";

export function ActivityFeed({
  projectId,
  projectName,
  activities,
  loadError,
}: {
  projectId: string;
  projectName: string;
  activities: ProjectActivity[];
  loadError: boolean;
}) {
  const groups = groupActivities(activities);
  return (
    <div className="space-y-6">
      <header>
        <Link
          className="text-muted-foreground hover:text-foreground text-sm"
          href={`/projects/${projectId}`}
        >
          {projectName}
        </Link>
        <p className="text-muted-foreground mt-3 text-sm">Project workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A timeline of changes made by your project team.
        </p>
      </header>
      {loadError ? (
        <p
          className="text-destructive border-destructive/30 bg-destructive/5 rounded-md border px-4 py-3 text-sm"
          role="alert"
        >
          Activity could not be loaded. Refresh the page to try again.
        </p>
      ) : null}
      {groups.length ? (
        <div className="space-y-7">
          {groups.map((group) => (
            <section aria-label={group.label} key={group.label}>
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {group.label}
              </h2>
              <ol className="bg-card divide-y rounded-lg border">
                {group.items.map((activity) => (
                  <li
                    className="flex gap-3 px-4 py-4 sm:px-5"
                    key={activity.id}
                  >
                    <span
                      aria-hidden="true"
                      className="bg-primary/70 mt-1.5 size-2 shrink-0 rounded-full"
                    />
                    <p className="min-w-0 flex-1 text-sm leading-6">
                      <span className="font-medium">
                        {activity.actor.fullName || activity.actor.email}
                      </span>{" "}
                      <span>{describeActivity(activity)}</span>
                    </p>
                    <time
                      className="text-muted-foreground shrink-0 pt-0.5 text-xs"
                      dateTime={activity.createdAt}
                    >
                      {new Intl.DateTimeFormat(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(activity.createdAt))}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : !loadError ? (
        <section className="bg-card flex min-h-64 flex-col items-center justify-center rounded-lg border px-6 text-center">
          <h2 className="font-semibold">No activity yet</h2>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Project changes, comments, and issue updates will appear here as
            your team works.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function groupActivities(activities: ProjectActivity[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const keys = new Map<string, ProjectActivity[]>();
  for (const activity of activities) {
    const date = new Date(activity.createdAt);
    const key = sameDay(date, today)
      ? "Today"
      : sameDay(date, yesterday)
        ? "Yesterday"
        : new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
            date
          );
    keys.set(key, [...(keys.get(key) ?? []), activity]);
  }
  return [...keys].map(([label, items]) => ({ label, items }));
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function describeActivity(activity: ProjectActivity) {
  const metadata = activity.metadata;
  const title =
    typeof metadata.title === "string"
      ? `“${metadata.title}”`
      : activity.entityType;
  const issue =
    typeof metadata.issue_number === "number"
      ? `#${metadata.issue_number} `
      : "";
  const sprint =
    typeof metadata.name === "string" ? `“${metadata.name}”` : "a sprint";
  const sprintTask =
    typeof metadata.task_title === "string"
      ? `“${metadata.task_title}”`
      : "a task";
  const fromStatus = humanize(metadata.from_status);
  const toStatus = humanize(metadata.to_status);
  const targetType = metadata.commentable_type === "issue" ? "issue" : "task";
  const member =
    typeof metadata.member_id === "string" ? "a project member" : "a member";
  const actions: Record<string, string> = {
    "project.created": `created this project`,
    "member.added": `added ${member}`,
    "member.removed": `removed ${member}`,
    "member.role_changed": `changed a member’s role to ${humanize(metadata.to_role)}`,
    "task.created": `created task ${title}`,
    "task.updated": `updated task ${title}`,
    "task.deleted": `deleted task ${title}`,
    "task.assigned": `changed the assignee for task ${title}`,
    "task.status_changed": `moved task ${title} from ${fromStatus} to ${toStatus}`,
    "issue.created": `reported issue ${issue}${title}`,
    "issue.updated": `updated issue ${issue}${title}`,
    "issue.deleted": `deleted issue ${issue}${title}`,
    "issue.assigned": `changed the assignee for issue ${issue}${title}`,
    "issue.status_changed": `changed issue ${issue}${title} from ${fromStatus} to ${toStatus}`,
    "sprint.created": `planned sprint ${sprint}`,
    "sprint.updated": `updated sprint ${sprint}`,
    "sprint.deleted": `deleted sprint ${sprint}`,
    "sprint.status_changed": `changed sprint ${sprint} from ${fromStatus} to ${toStatus}`,
    "sprint.task_added": `added task ${sprintTask} to sprint ${sprint}`,
    "sprint.task_removed": `returned task ${sprintTask} from sprint ${sprint} to the backlog`,
    "comment.added": `commented on a ${targetType}${typeof metadata.target_title === "string" ? `: “${metadata.target_title}”` : ""}`,
    "comment.edited": `edited a comment on a ${targetType}`,
  };
  return actions[activity.actionType] ?? `updated ${activity.entityType}`;
}

function humanize(value: unknown) {
  return typeof value === "string" ? value.replaceAll("_", " ") : "a status";
}
