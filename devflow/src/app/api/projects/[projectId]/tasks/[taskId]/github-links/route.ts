import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError } from "@/lib/http/api-response";

type Context = { params: Promise<{ projectId: string; taskId: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  const { projectId, taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  if (!(await getProjectRole(supabase, projectId, user.id))) return apiError("Project not found", "NOT_FOUND", 404);
  const { data, error } = await supabase.from("task_github_links").select("id, link_type, reference, html_url, title, created_at, github_repositories(owner, repo)")
    .eq("project_id", projectId).eq("task_id", taskId).order("created_at", { ascending: false });
  if (error) return apiError("Could not load linked GitHub work", "INTERNAL_ERROR", 500);
  return NextResponse.json({ data: data ?? [] });
}
export async function POST(request: NextRequest, { params }: Context) {
  const { projectId, taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.editTask(role)) return apiError("Not authorized", "FORBIDDEN", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (typeof body?.repositoryId !== "string" || typeof body.url !== "string" || typeof body.title !== "string" || typeof body.type !== "string")
    return apiError("Enter the repository, GitHub URL, title, and type", "VALIDATION_ERROR", 400);
  if (!(["commit", "pull_request", "issue"] as string[]).includes(body.type)) return apiError("Choose a valid GitHub item type", "VALIDATION_ERROR", 400);
  const { data: repository } = await supabase.from("github_repositories").select("id, owner, repo")
    .eq("id", body.repositoryId).eq("project_id", projectId).maybeSingle();
  if (!repository) return apiError("Connect this repository to the project first", "NOT_FOUND", 404);
  let url: URL;
  try { url = new URL(body.url); } catch { return apiError("Enter a valid GitHub URL", "VALIDATION_ERROR", 400); }
  const parts = url.pathname.split("/").filter(Boolean);
  const refType = parts[2]?.toLowerCase();
  const validPath = url.hostname.toLowerCase() === "github.com" && url.protocol === "https:"
    && parts[0]?.toLowerCase() === repository.owner.toLowerCase()
    && parts[1]?.toLowerCase() === repository.repo.toLowerCase() && parts.length === 4
    && (body.type === "pull_request" ? refType === "pull" : body.type === "issue" ? refType === "issues" : ["commit", "commits"].includes(refType ?? ""));
  if (!validPath || url.search || url.hash) return apiError("Use a matching pull request, issue, or commit URL from this repository", "VALIDATION_ERROR", 400);
  const reference = parts[3] ?? "";
  if (reference.length > 100 || body.title.trim().length < 1 || body.title.trim().length > 180) return apiError("Enter a short title and reference", "VALIDATION_ERROR", 400);
  const { data, error } = await supabase.from("task_github_links").insert({ project_id: projectId, task_id: taskId,
    repository_id: repository.id, link_type: body.type, reference, html_url: url.toString(), title: body.title.trim(), linked_by: user.id,
  }).select("id, link_type, reference, html_url, title, created_at").single();
  if (error) return apiError(error.code === "23505" ? "That GitHub link is already attached" : "Could not link GitHub work", error.code === "23505" ? "ALREADY_LINKED" : "INTERNAL_ERROR", error.code === "23505" ? 409 : 500);
  return NextResponse.json({ data }, { status: 201 });
}
export async function DELETE(request: NextRequest, { params }: Context) {
  const { projectId, taskId } = await params;
  const linkId = request.nextUrl.searchParams.get("linkId");
  if (!linkId) return apiError("Choose a link to remove", "VALIDATION_ERROR", 400);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.editTask(role)) return apiError("Not authorized", "FORBIDDEN", 403);
  const { error } = await supabase.from("task_github_links").delete().eq("id", linkId).eq("project_id", projectId).eq("task_id", taskId);
  if (error) return apiError("Could not remove GitHub link", "INTERNAL_ERROR", 500);
  return NextResponse.json({ data: { deleted: true } });
}
