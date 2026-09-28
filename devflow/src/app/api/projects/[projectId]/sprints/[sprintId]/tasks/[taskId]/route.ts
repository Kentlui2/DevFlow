import { NextResponse } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError } from "@/lib/http/api-response";
import { removeTaskFromSprint } from "@/lib/services/sprintService";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; sprintId: string; taskId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { projectId, sprintId, taskId } = await params;
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
  try {
    const removed = await removeTaskFromSprint(
      supabase,
      projectId,
      sprintId,
      taskId
    );
    return removed
      ? NextResponse.json({ data: { taskId } })
      : apiError("Sprint task not found", "NOT_FOUND", 404);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("SPRINT_ALREADY_COMPLETED")
    )
      return apiError(
        "Tasks cannot be removed from a completed sprint",
        "SPRINT_COMPLETED",
        400
      );
    return apiError(
      "Could not remove the task from this sprint",
      "INTERNAL_ERROR",
      500
    );
  }
}
