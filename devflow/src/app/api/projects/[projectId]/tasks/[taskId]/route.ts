import { NextResponse, type NextRequest } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import {
  deleteTask,
  getProjectTask,
  updateTask,
} from "@/lib/services/taskService";
import { updateTaskSchema } from "@/lib/validation/task";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string; taskId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId, taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);

  try {
    const task = await getProjectTask(supabase, projectId, taskId);
    return task
      ? NextResponse.json({ data: task })
      : apiError("Task not found", "NOT_FOUND", 404);
  } catch {
    return apiError("Could not load the task", "INTERNAL_ERROR", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId, taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.editTask(role))
    return apiError("Not authorized", "FORBIDDEN", 403);

  const parsed = updateTaskSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError(
      "Invalid task details",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  }

  try {
    const task = await updateTask(supabase, projectId, taskId, parsed.data);
    return task
      ? NextResponse.json({ data: task })
      : apiError("Task not found", "NOT_FOUND", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("TASK_ASSIGNEE_MUST_BE_PROJECT_MEMBER")) {
      return apiError(
        "Choose a member of this project",
        "INVALID_ASSIGNEE",
        400
      );
    }
    if (message.includes("TASK_LABELS_MUST_BELONG_TO_PROJECT")) {
      return apiError(
        "One or more labels do not belong to this project",
        "INVALID_LABELS",
        400
      );
    }
    return apiError("Could not update the task", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId, taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.deleteTask(role))
    return apiError("Not authorized", "FORBIDDEN", 403);

  try {
    const deleted = await deleteTask(supabase, projectId, taskId);
    return deleted
      ? NextResponse.json({ data: { deleted: true } })
      : apiError("Task not found", "NOT_FOUND", 404);
  } catch {
    return apiError("Could not delete the task", "INTERNAL_ERROR", 500);
  }
}
