import { NextResponse, type NextRequest } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import {
  deleteProjectIssue,
  getProjectIssue,
  updateProjectIssue,
} from "@/lib/services/collaborationService";
import { updateIssueSchema } from "@/lib/validation/collaboration";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ projectId: string; issueId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId, issueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  if (!(await getProjectRole(supabase, projectId, user.id)))
    return apiError("Project not found", "NOT_FOUND", 404);
  try {
    const issue = await getProjectIssue(supabase, projectId, issueId);
    return issue
      ? NextResponse.json({ data: issue })
      : apiError("Issue not found", "NOT_FOUND", 404);
  } catch {
    return apiError("Could not load the issue", "INTERNAL_ERROR", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId, issueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.editIssue(role))
    return apiError("Not authorized", "FORBIDDEN", 403);
  const parsed = updateIssueSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "Invalid issue details",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  try {
    const issue = await updateProjectIssue(
      supabase,
      projectId,
      issueId,
      parsed.data
    );
    return issue
      ? NextResponse.json({ data: issue })
      : apiError("Issue not found", "NOT_FOUND", 404);
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
    return apiError("Could not update the issue", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId, issueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.deleteIssue(role))
    return apiError("Not authorized", "FORBIDDEN", 403);
  try {
    const deleted = await deleteProjectIssue(supabase, projectId, issueId);
    return deleted
      ? NextResponse.json({ data: { deleted: true } })
      : apiError("Issue not found", "NOT_FOUND", 404);
  } catch {
    return apiError("Could not delete the issue", "INTERNAL_ERROR", 500);
  }
}
