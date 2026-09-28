import { NextResponse } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import { deleteSprint, updateSprint } from "@/lib/services/sprintService";
import { updateSprintSchema } from "@/lib/validation/sprint";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; sprintId: string }>;
};

async function authorize(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: apiError("Not authenticated", "UNAUTHENTICATED", 401) };
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return { error: apiError("Project not found", "NOT_FOUND", 404) };
  if (!permissions.manageSprint(role))
    return {
      error: apiError(
        "Only project owners can manage sprints",
        "FORBIDDEN",
        403
      ),
    };
  return { supabase };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { projectId, sprintId } = await params;
  const auth = await authorize(projectId);
  if ("error" in auth) return auth.error;
  const parsed = updateSprintSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "Invalid sprint details",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  try {
    const sprint = await updateSprint(
      auth.supabase,
      projectId,
      sprintId,
      parsed.data
    );
    return sprint
      ? NextResponse.json({ data: sprint })
      : apiError("Sprint not found", "NOT_FOUND", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("SPRINT_STATUS_TRANSITION_INVALID"))
      return apiError(
        "That sprint status change is not allowed",
        "INVALID_SPRINT_STATUS",
        400
      );
    if (message.includes("SPRINT_DATES_LOCKED_AFTER_START"))
      return apiError(
        "Sprint dates cannot change after a sprint starts",
        "SPRINT_DATES_LOCKED",
        400
      );
    if (message.includes("SPRINT_END_DATE_BEFORE_START_DATE"))
      return apiError(
        "End date must be on or after the start date",
        "INVALID_SPRINT_DATES",
        400
      );
    if (message.includes("SPRINT_ALREADY_COMPLETED"))
      return apiError(
        "Completed sprints cannot be changed",
        "SPRINT_COMPLETED",
        400
      );
    if (message.includes("sprints_project_name_unique"))
      return apiError(
        "A sprint with this name already exists",
        "SPRINT_NAME_TAKEN",
        409
      );
    if (message.includes("idx_sprints_one_active_per_project"))
      return apiError(
        "Complete the current active sprint before starting another",
        "ACTIVE_SPRINT_EXISTS",
        409
      );
    return apiError("Could not update the sprint", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { projectId, sprintId } = await params;
  const auth = await authorize(projectId);
  if ("error" in auth) return auth.error;
  try {
    const deleted = await deleteSprint(auth.supabase, projectId, sprintId);
    return deleted
      ? NextResponse.json({ data: { id: deleted.id } })
      : apiError("Sprint not found", "NOT_FOUND", 404);
  } catch {
    return apiError("Could not delete the sprint", "INTERNAL_ERROR", 500);
  }
}
