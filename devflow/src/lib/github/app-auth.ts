import { createSign } from "node:crypto";

const api = "https://api.github.com";
const apiHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "DevFlow",
};

function appJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) throw new Error("GitHub App credentials are not configured.");
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: Math.floor(Date.now() / 1000) - 30, exp: Math.floor(Date.now() / 1000) + 540, iss: appId })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  return `${unsigned}.${signer.sign(privateKey, "base64url")}`;
}

export function githubAppConfig() {
  const slug = process.env.GITHUB_APP_SLUG;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!slug || !clientId || !clientSecret || !process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) return null;
  return { slug, clientId, clientSecret };
}

export async function createInstallationToken(installationId: number, repositoryIds?: number[]) {
  const body = repositoryIds?.length ? { repository_ids: repositoryIds } : {};
  const response = await fetch(`${api}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { ...apiHeaders, Authorization: `Bearer ${appJwt()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not create a GitHub installation token (${response.status}).`);
  return (await response.json() as { token: string }).token;
}

export function githubApiHeaders(token?: string): HeadersInit {
  return { ...apiHeaders, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
