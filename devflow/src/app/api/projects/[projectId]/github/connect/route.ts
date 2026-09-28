import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { githubAppConfig } from "@/lib/github/app-auth";
import { encodeFlow, githubFlowCookie } from "@/lib/github/installation-flow";
import { apiError } from "@/lib/http/api-response";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return apiError("Project not found", "NOT_FOUND", 404);
  if (!permissions.editProject(role)) return apiError("Only project owners can connect GitHub", "FORBIDDEN", 403);
  const config = githubAppConfig();
  if (!config) return apiError("GitHub App is not configured yet", "GITHUB_APP_NOT_CONFIGURED", 503);
  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(`https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new?state=${encodeURIComponent(state)}`);
  response.cookies.set(githubFlowCookie, encodeFlow({ projectId, userId: user.id, state, stage: "install" }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/github", maxAge: 1800,
  });
  return response;
}
