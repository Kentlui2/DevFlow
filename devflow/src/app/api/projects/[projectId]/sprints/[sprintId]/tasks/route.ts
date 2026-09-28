import { NextResponse } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import { addTasksToSprint } from "@/lib/services/sprintService";
import { addSprintTasksSchema } from "@/lib/validation/sprint";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; sprintId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { projectId, sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.manageSprint(role))
    return apiError(
      "Only project owners can plan sprint tasks",
      "FORBIDDEN",
      403
    );
  const parsed = addSprintTasksSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "Choose one or more tasks",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  if (new Set(parsed.data.taskIds).size !== parsed.data.taskIds.length)
    return apiError("A task can only be added once", "VALIDATION_ERROR", 400);
  try {
    const added = await addTasksToSprint(
      supabase,
      projectId,
      sprintId,
      parsed.data.taskIds
    );
    return added
      ? NextResponse.json(
          { data: { added: parsed.data.taskIds.length } },
          { status: 201 }
        )
      : apiError("Sprint not found", "NOT_FOUND", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("SPRINT_TASK_MUST_BELONG_TO_PROJECT"))
      return apiError(
        "One or more tasks do not belong to this project",
        "INVALID_SPRINT_TASKS",
        400
      );
    if (message.includes("CANNOT_ADD_TASK_TO_COMPLETED_SPRINT"))
      return apiError(
        "Tasks cannot be added to a completed sprint",
        "SPRINT_COMPLETED",
        400
      );
    if (
      message.includes("duplicate key") ||
      message.includes("sprint_tasks_task_id_key")
    )
      return apiError(
        "One or more tasks already belong to a sprint",
        "TASK_ALREADY_SCHEDULED",
        409
      );
    return apiError("Could not add tasks to the sprint", "INTERNAL_ERROR", 500);
  }
}
