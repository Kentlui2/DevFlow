import { NextResponse, type NextRequest } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import {
  createProjectLabel,
  listProjectLabels,
} from "@/lib/services/taskService";
import { createLabelSchema } from "@/lib/validation/task";
import { createClient } from "@/lib/supabase/server";

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
  try {
    return NextResponse.json({
      data: await listProjectLabels(supabase, projectId),
    });
  } catch {
    return apiError("Could not load project labels", "INTERNAL_ERROR", 500);
  }
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
  if (!permissions.editTask(role))
    return apiError("Not authorized", "FORBIDDEN", 403);

  const parsed = createLabelSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError(
      "Invalid label",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  }
  try {
    const label = await createProjectLabel(supabase, projectId, parsed.data);
    return NextResponse.json({ data: label }, { status: 201 });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return apiError(
        "A label with that name already exists in this project",
        "LABEL_ALREADY_EXISTS",
        409
      );
    }
    return apiError("Could not create the label", "INTERNAL_ERROR", 500);
  }
}
