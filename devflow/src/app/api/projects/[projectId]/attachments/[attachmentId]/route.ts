import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError } from "@/lib/http/api-response";

type Context = { params: Promise<{ projectId: string; attachmentId: string }> };
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { projectId, attachmentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.deleteTask(role)) return apiError("Not authorized", "FORBIDDEN", 403);
  const { data: item } = await supabase.from("attachments").select("id, storage_path, uploaded_by")
    .eq("id", attachmentId).eq("project_id", projectId).maybeSingle();
  if (!item) return apiError("Attachment not found", "NOT_FOUND", 404);
  const { error: storageError } = await supabase.storage.from("devflow-attachments").remove([item.storage_path]);
  if (storageError) return apiError("Could not delete this file", "DELETE_FAILED", 400);
  const { error } = await supabase.from("attachments").delete().eq("id", item.id).eq("project_id", projectId);
  if (error) return apiError("Could not remove attachment details", "INTERNAL_ERROR", 500);
  return NextResponse.json({ data: { deleted: true } });
}
