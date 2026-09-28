import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { apiError } from "@/lib/http/api-response";
import { createInstallationToken, githubApiHeaders } from "@/lib/github/app-auth";

type Context = { params: Promise<{ projectId: string }> };
type Repository = { id: string; owner: string; repo: string; html_url: string; created_at: string; github_id: number | null; installation_id: number | null };
const githubApi = "https://api.github.com";

export async function GET(request: NextRequest, { params }: Context) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  if (!(await getProjectRole(supabase, projectId, user.id))) return apiError("Project not found", "NOT_FOUND", 404);
  const { data, error } = await supabase.from("github_repositories").select("id, owner, repo, html_url, created_at, github_id, installation_id")
    .eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) return apiError("Could not load GitHub repositories", "INTERNAL_ERROR", 500);
  if (request.nextUrl.searchParams.get("metadata") === "1") return NextResponse.json({ data: data ?? [] });
  const { data: installation } = await supabase.from("project_github_installations").select("installation_id, account_login, account_type")
    .eq("project_id", projectId).maybeSingle();
  const repos = await Promise.all(((data ?? []) as Repository[]).map(async (repository) => {
    const base = `${githubApi}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`;
    let headers: HeadersInit = githubApiHeaders();
    if (installation && repository.installation_id === installation.installation_id && repository.github_id) {
      try { headers = githubApiHeaders(await createInstallationToken(installation.installation_id, [repository.github_id])); }
      catch { return { ...repository, commits: [], pullRequests: [], issues: [], accessError: "Could not create a repository token. Check the GitHub App credentials and installation." }; }
    }
    const [commits, pulls, issues] = await Promise.all([
      githubFetch(`${base}/commits?per_page=8`, headers),
      githubFetch(`${base}/pulls?state=all&per_page=8`, headers),
      githubFetch(`${base}/issues?state=all&per_page=8`, headers),
    ]);
    const failedStatus = [commits.status, pulls.status, issues.status].find((status) => status !== undefined);
    const accessError = failedStatus === 401
      ? "GitHub rejected the installation token (401)."
      : failedStatus === 403
        ? "GitHub denied access (403). Check repository permissions, approve any pending App permission update, and check GitHub rate limits."
        : failedStatus === 404
          ? "GitHub could not find this repository for the App (404). Check that the repository is selected in the installation."
          : failedStatus !== undefined
            ? `GitHub activity request failed (${failedStatus}).`
            : undefined;
    return { ...repository, commits: commits.items, pullRequests: pulls.items, issues: issues.items.filter((item: { pull_request?: unknown }) => !item.pull_request), accessError };
  }));
  return NextResponse.json({ data: repos, installation: installation ?? null });
}

export async function POST(request: NextRequest, { params }: Context) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.editProject(role)) return apiError("Only project owners can connect repositories", "FORBIDDEN", 403);
  const body = await request.json().catch(() => null) as { url?: unknown; repositoryId?: unknown } | null;
  if (typeof body?.repositoryId === "string") {
    const { error } = await supabase.from("github_repositories").delete().eq("id", body.repositoryId).eq("project_id", projectId);
    if (error) return apiError("Could not disconnect repository", "INTERNAL_ERROR", 500);
    return NextResponse.json({ data: { disconnected: true } });
  }
  if (typeof body?.url !== "string") return apiError("Enter a GitHub repository URL", "VALIDATION_ERROR", 400);
  const match = body.url.trim().match(/^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/i);
  if (!match) return apiError("Use a repository URL such as https://github.com/owner/repo", "VALIDATION_ERROR", 400);
  const owner = match[1]; const repo = match[2].replace(/\.git$/i, "");
  let headers: HeadersInit = githubApiHeaders();
  let githubId: number | null = null;
  let installationId: number | null = null;
  const { data: installation } = await supabase.from("project_github_installations").select("installation_id")
    .eq("project_id", projectId).maybeSingle();
  if (installation) {
    try {
      const token = await createInstallationToken(installation.installation_id);
      const listed = await fetch(`${githubApi}/installation/repositories?per_page=100`, { headers: githubApiHeaders(token), cache: "no-store" });
      if (listed.ok) {
        const response = await listed.json() as { repositories?: Array<{ id: number; full_name: string }> };
        const matched = response.repositories?.find((item) => item.full_name.toLowerCase() === `${owner}/${repo}`.toLowerCase());
        if (matched) {
          githubId = matched.id;
          installationId = installation.installation_id;
          headers = githubApiHeaders(await createInstallationToken(installation.installation_id, [matched.id]));
        }
      }
    } catch { /* Public repositories can still be linked anonymously below. */ }
  }
  const check = await fetch(`${githubApi}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers, cache: "no-store" });
  if (!check.ok) return apiError(check.status === 404 ? "Repository not found or not accessible" : "GitHub could not verify this repository", "GITHUB_ERROR", check.status === 404 ? 404 : 502);
  const response = await check.json() as { html_url?: string };
  githubId ??= typeof (response as { id?: unknown }).id === "number" ? (response as { id: number }).id : null;
  const { data, error } = await supabase.from("github_repositories").upsert({
    project_id: projectId, owner, repo, github_id: githubId, installation_id: installationId,
    html_url: response.html_url ?? `https://github.com/${owner}/${repo}`, linked_by: user.id,
  }, { onConflict: "project_id,owner,repo" }).select("id, owner, repo, html_url, created_at").single();
  if (error) return apiError("Could not connect repository", "INTERNAL_ERROR", 500);
  return NextResponse.json({ data }, { status: 201 });
}

async function githubFetch(url: string, headers: HeadersInit): Promise<{ items: Array<{ pull_request?: unknown }>; status?: number }> {
  try {
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) return { items: [], status: response.status };
    const result: unknown = await response.json();
    return { items: Array.isArray(result) ? result as Array<{ pull_request?: unknown }> : [] };
  } catch { return { items: [], status: 0 }; }
}
