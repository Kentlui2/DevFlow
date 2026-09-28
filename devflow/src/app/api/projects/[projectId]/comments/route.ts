import { NextResponse, type NextRequest } from "next/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError, readJson } from "@/lib/http/api-response";
import {
  createComment,
  listComments,
} from "@/lib/services/collaborationService";
import {
  commentTargetSchema,
  createCommentSchema,
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
  if (!(await getProjectRole(supabase, projectId, user.id)))
    return apiError("Project not found", "NOT_FOUND", 404);
  const parsed = commentTargetSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.success)
    return apiError(
      "Choose a valid task or issue",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  try {
    return NextResponse.json({
      data: await listComments(
        supabase,
        projectId,
        parsed.data.commentableType,
        parsed.data.commentableId
      ),
    });
  } catch {
    return apiError("Could not load comments", "INTERNAL_ERROR", 500);
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
  if (!permissions.comment(role))
    return apiError("Not authorized", "FORBIDDEN", 403);
  const parsed = createCommentSchema.safeParse(await readJson(request));
  if (!parsed.success)
    return apiError(
      "Write a valid comment",
      "VALIDATION_ERROR",
      400,
      parsed.error.flatten()
    );
  try {
    const comment = await createComment(
      supabase,
      projectId,
      user.id,
      parsed.data
    );
    return NextResponse.json({ data: comment }, { status: 201 });
  } catch {
    return apiError("Could not post the comment", "INTERNAL_ERROR", 500);
  }
}
