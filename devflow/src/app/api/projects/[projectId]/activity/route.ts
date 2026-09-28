import { NextResponse, type NextRequest } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError } from "@/lib/http/api-response";
import { listProjectActivity } from "@/lib/services/collaborationService";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  void _request;
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.viewActivity(role))
    return apiError("Not authorized", "FORBIDDEN", 403);
  try {
    return NextResponse.json({
      data: await listProjectActivity(supabase, projectId),
    });
  } catch {
    return apiError("Could not load project activity", "INTERNAL_ERROR", 500);
  }
}
