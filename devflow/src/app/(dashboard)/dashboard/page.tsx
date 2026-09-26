import Link from "next/link";
import { ArrowRight, CheckCheck, CircleDashed, Clock3, ListTodo } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string;
};

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (Math.abs(seconds) < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}

function readable(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  switch (status) {
    case "done":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    case "in_progress":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    case "in_review":
      return "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
    case "backlog":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: assignedTasks }, { data: memberships }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, project_id")
      .eq("assignee_id", user!.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase.from("project_members").select("project_id").eq("user_id", user!.id),
  ]);

  const tasks = (assignedTasks ?? []) as Task[];
  const projectIds = [...new Set(memberships?.map((membership) => membership.project_id) ?? [])];
  const taskProjectIds = [...new Set(tasks.map((task) => task.project_id))];

  const [{ data: taskCounts }, { data: taskProjects }, { data: activities }] = await Promise.all([
    supabase.from("tasks").select("status").eq("assignee_id", user!.id),
    taskProjectIds.length
      ? supabase.from("projects").select("id, name").in("id", taskProjectIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? supabase
          .from("activities")
          .select("id, action_type, entity_type, entity_id, created_at, actor_id, project_id")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const activityRows = activities ?? [];
  const actorIds = [...new Set(activityRows.map((activity) => activity.actor_id))];
  const activityProjectIds = [...new Set(activityRows.map((activity) => activity.project_id))];
  const activityTaskIds = [...new Set(activityRows.filter((activity) => activity.entity_type === "task").map((activity) => activity.entity_id))];
  const [{ data: actors }, { data: activityProjects }, { data: activityTasks }] = await Promise.all([
    actorIds.length
      ? supabase.from("users").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] }),
    activityProjectIds.length
      ? supabase.from("projects").select("id, name").in("id", activityProjectIds)
      : Promise.resolve({ data: [] }),
    activityTaskIds.length
      ? supabase.from("tasks").select("id, title").in("id", activityTaskIds)
      : Promise.resolve({ data: [] }),
  ]);

  const projectNames = new Map((taskProjects ?? []).map((project) => [project.id, project.name]));
  const activityProjectNames = new Map((activityProjects ?? []).map((project) => [project.id, project.name]));
  const actorNames = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name || "A teammate"]));
  const activityTaskNames = new Map((activityTasks ?? []).map((task) => [task.id, task.title]));
  const counts = taskCounts ?? [];
  const inProgressCount = counts.filter((task) => task.status === "in_progress").length;
  const inReviewCount = counts.filter((task) => task.status === "in_review").length;
  const name = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "there";

  const summary = [
    { label: "My tasks", value: counts.length, icon: ListTodo, tone: "text-primary bg-primary/10" },
    { label: "In progress", value: inProgressCount, icon: Clock3, tone: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950" },
    { label: "In review", value: inReviewCount, icon: CircleDashed, tone: "text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950" },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome back, {name}</h1>
          <p className="text-muted-foreground mt-2 text-sm">Here’s what’s happening across your projects.</p>
        </div>
        <Link className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline" href="/projects">
          View projects <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>

      <section aria-label="Task summary" className="grid gap-4 sm:grid-cols-3">
        {summary.map(({ label, value, icon: Icon, tone }) => (
          <article className="rounded-lg border bg-card p-5" key={label}>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{label}</p>
              <span className={`grid size-9 place-items-center rounded-md ${tone}`}>
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">My tasks</h2>
              <p className="text-muted-foreground mt-1 text-xs">The next tasks assigned to you</p>
            </div>
            <span className="text-muted-foreground text-xs">{counts.length} total</span>
          </div>
          {tasks.length ? (
            <ul className="divide-y">
              {tasks.map((task) => (
                <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" key={task.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {projectNames.get(task.project_id) ?? "Project"}
                      {task.due_date ? ` · Due ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${task.due_date}T00:00:00`))}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-1 text-[11px] font-medium ${statusClass(task.status)}`}>
                    {readable(task.status)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <span className="bg-muted mx-auto grid size-10 place-items-center rounded-full">
                <CheckCheck aria-hidden="true" className="text-muted-foreground size-5" />
              </span>
              <h3 className="mt-3 text-sm font-medium">You’re all caught up</h3>
              <p className="text-muted-foreground mt-1 text-sm">Tasks assigned to you will show up here.</p>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Recent activity</h2>
            <p className="text-muted-foreground mt-1 text-xs">Latest changes in your projects</p>
          </div>
          {activityRows.length ? (
            <ol className="divide-y">
              {activityRows.map((activity) => (
                <li className="flex gap-3 px-5 py-4" key={activity.id}>
                  <span aria-hidden="true" className="bg-primary/70 mt-1.5 size-2 shrink-0 rounded-full" />
                  <div className="min-w-0">
                    <p className="text-sm leading-5">
                      <span className="font-medium">{actorNames.get(activity.actor_id) ?? "A teammate"}</span>{" "}
                      {readable(activity.action_type)}
                      {activityTaskNames.has(activity.entity_id) ? <span> “{activityTaskNames.get(activity.entity_id)}”</span> : null}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-xs">
                      {activityProjectNames.get(activity.project_id) ?? "Project"} · {relativeTime(activity.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-muted-foreground mt-1 text-sm">Project updates will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
