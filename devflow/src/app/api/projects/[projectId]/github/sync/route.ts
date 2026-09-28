import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError } from "@/lib/http/api-response";
import { syncProjectGithubRepositories } from "@/lib/github/sync-project-repositories";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(_request: NextRequest, { params }: Context) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.editProject(role)) return apiError("Only project owners can sync GitHub repositories", "FORBIDDEN", 403);

  const { data: installation, error } = await supabase.from("project_github_installations").select("installation_id")
    .eq("project_id", projectId).maybeSingle();
  if (error) return apiError("Could not load this project's GitHub installation", "INTERNAL_ERROR", 500);
  if (!installation) return apiError("Install the GitHub App for this project first", "GITHUB_APP_NOT_CONNECTED", 409);

  try {
    const syncedCount = await syncProjectGithubRepositories(supabase, projectId, installation.installation_id, user.id);
    return NextResponse.json({ data: { syncedCount } });
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "GitHub repository sync failed.";
    return apiError(message, "GITHUB_SYNC_FAILED", 502);
  }
}
