import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProjectMembersManager, type ProjectMember } from "@/components/projects/project-members-manager";
import { getProjectRole } from "@/lib/auth/project-access";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectMembersPage({ params }: PageProps<"/projects/[projectId]/members">) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || !user) notFound();

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) notFound();

  const { data: members, error } = await supabase
    .from("project_members")
    .select("id, user_id, role, joined_at, profile:users(id, email, full_name)")
    .eq("project_id", projectId)
    .order("joined_at", { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <Link className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm" href={`/projects/${project.id}`}>
          <ArrowLeft aria-hidden="true" className="size-4" /> {project.name}
        </Link>
        <header className="mt-5">
          <p className="text-muted-foreground text-sm">Project settings</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Members</h1>
          <p className="text-muted-foreground mt-2 text-sm">Manage access to {project.name}.</p>
        </header>
      </div>
      {error ? (
        <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
          <h2 className="font-medium">Couldn’t load project members</h2>
          <p className="text-muted-foreground mt-1 text-sm">Refresh the page and try again.</p>
        </section>
      ) : (
        <ProjectMembersManager
          canManage={role === "owner"}
          initialMembers={(members ?? []) as unknown as ProjectMember[]}
          projectId={projectId}
        />
      )}
    </div>
  );
}
