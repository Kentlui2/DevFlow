import { NextResponse } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import { createSprintSchema } from "@/lib/validation/sprint";
import {
  createSprint,
  getProjectSprintWorkspace,
} from "@/lib/services/sprintService";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  if (!(await getProjectRole(supabase, projectId, user.id)))
    return apiError("Project not found", "NOT_FOUND", 404);
  try {
    const workspace = await getProjectSprintWorkspace(supabase, projectId);
    return NextResponse.json({ data: workspace.sprints });
  } catch {
    return apiError("Could not load project sprints", "INTERNAL_ERROR", 500);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.manageSprint(role))
    return apiError("Only project owners can manage sprints", "FORBIDDEN", 403);
  const parsed = createSprintSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "Invalid sprint details",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  try {
    const sprint = await createSprint(
      supabase,
      projectId,
      user.id,
      parsed.data
    );
    return NextResponse.json({ data: sprint }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("sprints_project_name_unique")
    )
      return apiError(
        "A sprint with this name already exists",
        "SPRINT_NAME_TAKEN",
        409
      );
    return apiError("Could not create the sprint", "INTERNAL_ERROR", 500);
  }
}
