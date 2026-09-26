import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  ListTodo,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";

const projectSections: {
  label: string;
  detail: string;
  icon: LucideIcon;
  href?: string;
  action?: string;
}[] = [
  {
    label: "Board",
    detail: "Move work through your team’s workflow",
    icon: ListTodo,
    href: "board",
    action: "Open",
  },
  { label: "Backlog", detail: "Prioritize upcoming work", icon: CircleDashed },
  {
    label: "Sprints",
    detail: "Plan and track development cycles",
    icon: CheckCircle2,
  },
  {
    label: "Members",
    detail: "Manage project access and roles",
    icon: UsersRound,
    href: "members",
    action: "Manage",
  },
];

export default async function ProjectOverviewPage({
  params,
}: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, owner_id, created_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();
  const isOwner = project.owner_id === user?.id;

  const [{ data: tasks }, { count: memberCount }] = await Promise.all([
    supabase.from("tasks").select("id, status").eq("project_id", projectId),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);
  const projectTasks = tasks ?? [];
  const completed = projectTasks.filter(
    (task) => task.status === "done"
  ).length;
  const inProgress = projectTasks.filter(
    (task) => task.status === "in_progress"
  ).length;
  const completion = projectTasks.length
    ? Math.round((completed / projectTasks.length) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <Link
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
          href="/projects"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> All projects
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Project overview</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
              {project.description ||
                "A shared workspace for your team’s development work."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
              href={`/projects/${project.id}/members`}
            >
              {memberCount ?? 0} members
            </Link>
            {isOwner ? <ProjectFormDialog project={project} /> : null}
            {isOwner ? (
              <DeleteProjectButton
                projectId={project.id}
                projectName={project.name}
              />
            ) : null}
          </div>
        </div>
      </div>

      <section
        aria-label="Project summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        {[
          { label: "Tasks", value: projectTasks.length },
          { label: "Completed", value: completed },
          { label: "In progress", value: inProgress },
        ].map(({ label, value }) => (
          <article className="bg-card rounded-lg border p-5" key={label}>
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
          </article>
        ))}
      </section>

      <section className="bg-card rounded-lg border p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Project progress</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Based on completed tasks
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {completion}%
          </span>
        </div>
        <div
          aria-label="Project completion"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={completion}
          className="bg-muted mt-5 h-2 overflow-hidden rounded-full"
          role="progressbar"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width]"
            style={{ width: `${completion}%` }}
          />
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="font-semibold">Project workspace</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Your core project areas
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {projectSections.map(({ label, detail, icon: Icon, href, action }) =>
            href ? (
              <Link
                className="bg-card hover:border-primary/40 hover:bg-accent/30 flex items-start gap-3 rounded-lg border p-4 transition-colors"
                href={`/projects/${project.id}/${href}`}
                key={label}
              >
                <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-md">
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <div>
                  <h3 className="text-sm font-medium">{label}</h3>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {detail}
                  </p>
                </div>
                <span className="text-primary ml-auto shrink-0 text-xs font-medium">
                  {action}
                </span>
              </Link>
            ) : (
              <div
                className="bg-card flex items-start gap-3 rounded-lg border p-4"
                key={label}
              >
                <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-md">
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <div>
                  <h3 className="text-sm font-medium">{label}</h3>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {detail}
                  </p>
                </div>
                <span className="text-muted-foreground ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[10px]">
                  Planned
                </span>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
