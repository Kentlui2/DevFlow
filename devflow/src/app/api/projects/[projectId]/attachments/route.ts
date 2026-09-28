import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError } from "@/lib/http/api-response";

type Context = { params: Promise<{ projectId: string }> };
const bucket = "devflow-attachments";
const allowedTypes = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
  "text/plain", "text/markdown", "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function GET(request: NextRequest, { params }: Context) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  if (!(await getProjectRole(supabase, projectId, user.id))) return apiError("Project not found", "NOT_FOUND", 404);
  const targetType = request.nextUrl.searchParams.get("targetType");
  const targetId = request.nextUrl.searchParams.get("targetId");
  if (!targetType || !targetId) return apiError("Choose an attachment target", "VALIDATION_ERROR", 400);
  const { data, error } = await supabase.from("attachments").select("id, file_name, storage_path, content_type, file_size, created_at, uploaded_by")
    .eq("project_id", projectId).eq("target_type", targetType).eq("target_id", targetId).order("created_at");
  if (error) return apiError("Could not load attachments", "INTERNAL_ERROR", 500);
  const attachments = await Promise.all((data ?? []).map(async (item) => {
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(item.storage_path, 3600);
    return { ...item, downloadUrl: signed?.signedUrl ?? null };
  }));
  return NextResponse.json({ data: attachments });
}

export async function POST(request: NextRequest, { params }: Context) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.createTask(role)) return apiError("Not authorized", "FORBIDDEN", 403);
  const form = await request.formData();
  const file = form.get("file");
  const targetType = form.get("targetType");
  const targetId = form.get("targetId");
  if (!(file instanceof File) || typeof targetType !== "string" || typeof targetId !== "string")
    return apiError("Choose a file and a valid target", "VALIDATION_ERROR", 400);
  if (!allowedTypes.has(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024)
    return apiError("Use a supported file up to 10 MB", "VALIDATION_ERROR", 400);
  if (!(["task", "issue", "comment"] as string[]).includes(targetType)) return apiError("Choose a valid target", "VALIDATION_ERROR", 400);
  const fileName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(-160) || "attachment";
  const storagePath = `${projectId}/${targetType}/${targetId}/${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return apiError("Could not upload this file", "UPLOAD_FAILED", 400);
  const { data, error } = await supabase.from("attachments").insert({
    project_id: projectId, target_type: targetType, target_id: targetId,
    uploaded_by: user.id, file_name: fileName, storage_path: storagePath,
    content_type: file.type, file_size: file.size,
  }).select("id, file_name, storage_path, content_type, file_size, created_at, uploaded_by").single();
  if (error) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return apiError("Could not attach this file to that item", "ATTACHMENT_FAILED", 400);
  }
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
  return NextResponse.json({ data: { ...data, downloadUrl: signed?.signedUrl ?? null } }, { status: 201 });
}
