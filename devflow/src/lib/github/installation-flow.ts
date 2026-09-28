import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const githubFlowCookie = "devflow_github_install_flow";
export type GithubFlow = { projectId: string; userId: string; state: string; stage: "install" | "oauth"; installationId?: number };

export function newState() { return randomBytes(32).toString("base64url"); }

export function encodeFlow(flow: GithubFlow) {
  const secret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!secret) throw new Error("GitHub App credentials are not configured.");
  const payload = Buffer.from(JSON.stringify(flow)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function decodeFlow(value?: string | null): GithubFlow | null {
  const secret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!secret || !value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const flow = JSON.parse(Buffer.from(payload, "base64url").toString()) as GithubFlow;
    if (!flow.projectId || !flow.userId || !flow.state || !["install", "oauth"].includes(flow.stage)) return null;
    if (flow.stage === "oauth" && (!Number.isSafeInteger(flow.installationId) || !flow.installationId)) return null;
    return flow;
  } catch { return null; }
}
