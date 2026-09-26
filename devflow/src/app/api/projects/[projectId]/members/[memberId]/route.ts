import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import { removeProjectMember, updateProjectMemberRole } from "@/lib/services/projectService";
import { updateProjectMemberSchema } from "@/lib/validation/project";

type RouteContext = { params: Promise<{ projectId: string; memberId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId, memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.manageMembers(role)) return apiError("Not authorized", "FORBIDDEN", 403);

  const parsed = updateProjectMemberSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("Invalid member role", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const member = await updateProjectMemberRole(supabase, projectId, memberId, parsed.data.role);
    if (!member) return apiError("Member not found", "NOT_FOUND", 404);
    return NextResponse.json({ data: member });
  } catch {
    return apiError("Could not update member role", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId, memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.manageMembers(role)) return apiError("Not authorized", "FORBIDDEN", 403);

  try {
    const member = await removeProjectMember(supabase, projectId, memberId);
    if (!member) return apiError("Member not found", "NOT_FOUND", 404);
    return NextResponse.json({ data: { removed: true } });
  } catch {
    return apiError("Could not remove member", "INTERNAL_ERROR", 500);
  }
}
