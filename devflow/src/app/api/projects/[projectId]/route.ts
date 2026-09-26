import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import { deleteProject, updateProject } from "@/lib/services/projectService";
import { updateProjectSchema } from "@/lib/validation/project";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, description, owner_id, created_at, updated_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) return apiError("Could not load project", "INTERNAL_ERROR", 500);
  if (!project) return apiError("Project not found", "NOT_FOUND", 404);

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role || !permissions.viewProject(role)) return apiError("Project not found", "NOT_FOUND", 404);
  return NextResponse.json({ data: { ...project, role } });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.editProject(role)) return apiError("Not authorized", "FORBIDDEN", 403);

  const parsed = updateProjectSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("Invalid project details", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }
  try {
    const project = await updateProject(supabase, projectId, parsed.data);
    return NextResponse.json({ data: project });
  } catch {
    return apiError("Could not update the project", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.deleteProject(role)) return apiError("Not authorized", "FORBIDDEN", 403);

  try {
    await deleteProject(supabase, projectId);
    return NextResponse.json({ data: { deleted: true } });
  } catch {
    return apiError("Could not delete the project", "INTERNAL_ERROR", 500);
  }
}
