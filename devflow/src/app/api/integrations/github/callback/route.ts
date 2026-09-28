import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { githubApiHeaders, githubAppConfig } from "@/lib/github/app-auth";
import { decodeFlow, githubFlowCookie } from "@/lib/github/installation-flow";
import { syncProjectGithubRepositories } from "@/lib/github/sync-project-repositories";

type Installation = { id: number; app_id: number; account?: { id: number; login: string; type: string } };

function finish(request: NextRequest, status: string, projectId?: string) {
  const target = new URL(projectId ? `/projects/${projectId}/github` : "/", request.url);
  target.searchParams.set("github", status);
  const response = NextResponse.redirect(target);
  response.cookies.set(githubFlowCookie, "", { path: "/api/integrations/github", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const flow = decodeFlow(request.cookies.get(githubFlowCookie)?.value);
  const config = githubAppConfig();
  if (!code || !state || !flow || flow.stage !== "oauth" || state !== flow.state || !config || !flow.installationId) return finish(request, "setup_failed", flow?.projectId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== flow.userId) return finish(request, "session_expired", flow.projectId);

  try {
    const callbackUrl = new URL("/api/integrations/github/callback", request.url).toString();
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: callbackUrl }), cache: "no-store",
    });
    if (!tokenResponse.ok) return finish(request, "authorization_failed", flow.projectId);
    const token = (await tokenResponse.json() as { access_token?: string }).access_token;
    if (!token) return finish(request, "authorization_failed", flow.projectId);
    const installationResponse = await fetch("https://api.github.com/user/installations?per_page=100", {
      headers: githubApiHeaders(token), cache: "no-store",
    });
    if (!installationResponse.ok) return finish(request, "installation_unverified", flow.projectId);
    const installations = await installationResponse.json() as { installations?: Installation[] };
    const installation = installations.installations?.find((entry) => entry.id === flow.installationId && String(entry.app_id) === process.env.GITHUB_APP_ID);
    if (!installation?.account) return finish(request, "installation_unverified", flow.projectId);

    const { error: installError } = await supabase.from("project_github_installations").upsert({
      project_id: flow.projectId, installation_id: flow.installationId,
      account_id: installation.account.id, account_login: installation.account.login,
      account_type: installation.account.type, connected_by: user.id,
    }, { onConflict: "project_id" });
    if (installError) return finish(request, "save_failed", flow.projectId);
    try { await syncProjectGithubRepositories(supabase, flow.projectId, flow.installationId, user.id); }
    catch { return finish(request, "repositories_unavailable", flow.projectId); }
    return finish(request, "connected", flow.projectId);
  } catch {
    return finish(request, "connection_failed", flow.projectId);
  }
}
