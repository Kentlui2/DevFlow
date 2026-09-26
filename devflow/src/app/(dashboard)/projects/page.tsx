import Link from "next/link";
import { ArrowRight, FolderKanban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id, role")
    .eq("user_id", user!.id);
  const ids = memberships?.map((item) => item.project_id) ?? [];
  const { data: projects } = ids.length
    ? await supabase.from("projects").select("id, name, description, updated_at").in("id", ids).order("updated_at", { ascending: false })
    : { data: [] };
  const roles = new Map((memberships ?? []).map((item) => [item.project_id, item.role]));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-2 text-sm">Projects you own or collaborate on.</p>
        </div>
        <ProjectFormDialog />
      </header>
      {projects?.length ? (
        <section aria-label="Projects" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link className="group rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30" href={`/projects/${project.id}`} key={project.id}>
              <div className="flex items-start justify-between gap-4">
                <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-lg">
                  <FolderKanban aria-hidden="true" className="size-5" />
                </span>
                <span className="text-muted-foreground text-xs capitalize">{roles.get(project.id)}</span>
              </div>
              <h2 className="mt-5 font-semibold">{project.name}</h2>
              <p className="text-muted-foreground mt-2 line-clamp-2 min-h-10 text-sm leading-5">
                {project.description || "A shared workspace for your team’s development work."}
              </p>
              <span className="text-primary mt-5 inline-flex items-center gap-1 text-sm font-medium">
                Open project <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-lg border bg-card px-6 py-16 text-center">
          <span className="bg-muted mx-auto grid size-12 place-items-center rounded-xl">
            <FolderKanban aria-hidden="true" className="text-muted-foreground size-6" />
          </span>
          <h2 className="mt-4 font-semibold">No projects yet</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-6">
            When you create a project or join a team, it will appear here.
          </p>
        </section>
      )}
    </div>
  );
}
