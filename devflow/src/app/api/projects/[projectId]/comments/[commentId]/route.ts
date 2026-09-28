import { NextResponse, type NextRequest } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import {
  deleteComment,
  updateComment,
} from "@/lib/services/collaborationService";
import { updateCommentSchema } from "@/lib/validation/collaboration";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ projectId: string; commentId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { projectId, commentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.comment(role))
    return apiError("Not authorized", "FORBIDDEN", 403);
  const parsed = updateCommentSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "Write a valid comment",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  try {
    const comment = await updateComment(
      supabase,
      projectId,
      commentId,
      user.id,
      parsed.data
    );
    return comment
      ? NextResponse.json({ data: comment })
      : apiError("Comment not found or you cannot edit it", "NOT_FOUND", 404);
  } catch {
    return apiError("Could not update the comment", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  void _request;
  const { projectId, commentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.comment(role))
    return apiError("Not authorized", "FORBIDDEN", 403);
  try {
    const deleted = await deleteComment(
      supabase,
      projectId,
      commentId,
      user.id
    );
    return deleted
      ? NextResponse.json({ data: { deleted: true } })
      : apiError("Comment not found or you cannot delete it", "NOT_FOUND", 404);
  } catch {
    return apiError("Could not delete the comment", "INTERNAL_ERROR", 500);
  }
}
