import { notFound } from "next/navigation";
import { SprintWorkspace } from "@/components/projects/sprint-workspace";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import {
  getProjectSprintWorkspace,
  type SprintWithTasks,
} from "@/lib/services/sprintService";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectSprintsPage({
  params,
}: PageProps<"/projects/[projectId]/sprints">) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const [{ data: project }, role] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle(),
    getProjectRole(supabase, projectId, user.id),
  ]);
  if (!project || !role) notFound();

  let initialSprints: SprintWithTasks[] = [];
  let loadError = false;
  try {
    initialSprints = (await getProjectSprintWorkspace(supabase, projectId))
      .sprints;
  } catch {
    loadError = true;
  }

  return (
    <SprintWorkspace
      canManage={permissions.manageSprint(role)}
      initialSprints={initialSprints}
      loadError={loadError}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
