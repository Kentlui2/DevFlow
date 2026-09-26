import { NextResponse, type NextRequest } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError } from "@/lib/http/api-response";
import { deleteProjectLabel } from "@/lib/services/taskService";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string; labelId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId, labelId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.editTask(role))
    return apiError("Not authorized", "FORBIDDEN", 403);

  try {
    const deleted = await deleteProjectLabel(supabase, projectId, labelId);
    return deleted
      ? NextResponse.json({ data: { deleted: true } })
      : apiError("Label not found", "NOT_FOUND", 404);
  } catch {
    return apiError("Could not delete the label", "INTERNAL_ERROR", 500);
  }
}
