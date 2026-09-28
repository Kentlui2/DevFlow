import { notFound } from "next/navigation";
import { AnalyticsDashboard } from "@/components/projects/analytics-dashboard";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { getProjectAnalytics } from "@/lib/services/analyticsService";
import { createClient } from "@/lib/supabase/server";
import type { ProjectAnalytics } from "@/lib/services/analyticsService";

export default async function ProjectAnalyticsPage({
  params,
}: PageProps<"/projects/[projectId]/analytics">) {
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
  if (!project || !role || !permissions.viewAnalytics(role)) notFound();

  let analytics: ProjectAnalytics | null = null;
  let loadError = false;
  try {
    analytics = await getProjectAnalytics(supabase, projectId);
  } catch {
    loadError = true;
  }

  return (
    <AnalyticsDashboard
      analytics={analytics}
      loadError={loadError}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
