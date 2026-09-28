import { NextResponse, type NextRequest } from "next/server";
import { githubAppConfig } from "@/lib/github/app-auth";
import { decodeFlow, encodeFlow, githubFlowCookie, newState } from "@/lib/github/installation-flow";

export async function GET(request: NextRequest) {
  const installationId = Number(request.nextUrl.searchParams.get("installation_id"));
  const state = request.nextUrl.searchParams.get("state");
  const flow = decodeFlow(request.cookies.get(githubFlowCookie)?.value);
  const config = githubAppConfig();
  if (!flow || flow.stage !== "install" || !state || state !== flow.state || !Number.isSafeInteger(installationId) || installationId < 1 || !config) {
    const target = new URL(flow ? `/projects/${flow.projectId}/github` : "/", request.url);
    target.searchParams.set("github", "setup_failed");
    return NextResponse.redirect(target);
  }
  const oauthState = newState();
  const nextFlow = { ...flow, stage: "oauth" as const, state: oauthState, installationId };
  const callback = new URL("/api/integrations/github/callback", request.url).toString();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("state", oauthState);
  const response = NextResponse.redirect(authorize);
  response.cookies.set(githubFlowCookie, encodeFlow(nextFlow), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/github", maxAge: 1800,
  });
  return response;
}
