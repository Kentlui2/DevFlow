import { NextResponse, type NextRequest } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import {
  createProjectIssue,
  listProjectIssues,
} from "@/lib/services/collaborationService";
import {
  createIssueSchema,
  issueFiltersSchema,
} from "@/lib/validation/collaboration";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  const parsed = issueFiltersSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.success)
    return apiError(
      "Invalid issue filters",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  try {
    return NextResponse.json({
      data: await listProjectIssues(supabase, projectId, parsed.data),
    });
  } catch {
    return apiError("Could not load project issues", "INTERNAL_ERROR", 500);
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
  if (!permissions.createIssue(role))
    return apiError("Not authorized", "FORBIDDEN", 403);
  const parsed = createIssueSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "Invalid issue details",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  try {
    const issue = await createProjectIssue(
      supabase,
      projectId,
      user.id,
      parsed.data
    );
    return NextResponse.json({ data: issue }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ISSUE_ASSIGNEE_MUST_BE_PROJECT_MEMBER"))
      return apiError(
        "Choose a member of this project",
        "INVALID_ASSIGNEE",
        400
      );
    if (message.includes("ISSUE_LABELS_MUST_BELONG_TO_PROJECT"))
      return apiError(
        "One or more labels do not belong to this project",
        "INVALID_LABELS",
        400
      );
    return apiError("Could not create the issue", "INTERNAL_ERROR", 500);
  }
}
