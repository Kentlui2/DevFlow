import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/projects/activity-feed";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { listProjectActivity } from "@/lib/services/collaborationService";
import { createClient } from "@/lib/supabase/server";
import type { ProjectActivity } from "@/lib/types/collaboration";

export default async function ProjectActivityPage({
  params,
}: PageProps<"/projects/[projectId]/activity">) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) notFound();
  let activities: ProjectActivity[] = [];
  let loadError = false;
  try {
    if (permissions.viewActivity(role))
      activities = await listProjectActivity(supabase, projectId);
  } catch {
    loadError = true;
  }
  return (
    <ActivityFeed
      activities={activities}
      loadError={loadError}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
