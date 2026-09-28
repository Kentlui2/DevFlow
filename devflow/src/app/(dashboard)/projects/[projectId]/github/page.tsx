import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GithubWorkspace } from "@/components/projects/github-workspace";
import { getProjectRole } from "@/lib/auth/project-access";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectGithubPage({ params, searchParams }: PageProps<"/projects/[projectId]/github">) {
  const { projectId } = await params;
  const { github: statusParam } = await searchParams;
  const github = Array.isArray(statusParam) ? statusParam[0] : statusParam;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle();
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!project || !role) notFound();
  return <section className="space-y-6">
    <header>
      <Link className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm" href={`/projects/${project.id}`}><ArrowLeft className="size-4" />{project.name}</Link>
      <p className="text-muted-foreground mt-5 text-sm">Project integration</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">GitHub</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">Connect a repository to see recent commits, pull requests, and issues. Link individual items to tasks from the task details.</p>
    </header>
    <GithubWorkspace canManage={role === "owner"} githubStatus={github} projectId={projectId} />
  </section>;
}
