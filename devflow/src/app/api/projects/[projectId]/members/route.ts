import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import { addProjectMember } from "@/lib/services/projectService";
import { addProjectMemberSchema } from "@/lib/validation/project";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);

  const { data: members, error } = await supabase
    .from("project_members")
    .select("id, user_id, role, joined_at, profile:users(id, email, full_name)")
    .eq("project_id", projectId)
    .order("joined_at", { ascending: true });
  if (error) return apiError("Could not load project members", "INTERNAL_ERROR", 500);
  return NextResponse.json({ data: members });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.manageMembers(role)) return apiError("Not authorized", "FORBIDDEN", 403);

  const parsed = addProjectMemberSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("Invalid member details", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const member = await addProjectMember(supabase, projectId, parsed.data);
    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("MEMBER_ACCOUNT_NOT_FOUND")) {
      return apiError("No DevFlow account was found for that email", "MEMBER_NOT_FOUND", 404);
    }
    if (message.includes("MEMBER_ALREADY_EXISTS")) {
      return apiError("That person is already a project member", "ALREADY_MEMBER", 409);
    }
    if (message.includes("CANNOT_ADD_SELF")) {
      return apiError("You are already the project owner", "CANNOT_ADD_SELF", 409);
    }
    return apiError("Could not add the project member", "INTERNAL_ERROR", 500);
  }
}
