"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, GitBranch, GitCommitHorizontal, GitPullRequest, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GithubItem = { title?: string; html_url?: string; url?: string; sha?: string; commit?: { message?: string; author?: { date?: string } }; user?: { login?: string }; number?: number; state?: string; created_at?: string };
type Repo = { id: string; owner: string; repo: string; html_url: string; commits: GithubItem[]; pullRequests: GithubItem[]; issues: GithubItem[]; accessError?: string };
type Installation = { account_login: string; account_type: string } | null;
const githubMessages: Record<string, string> = {
  connected: "GitHub is connected. The project now has access to the repositories selected during installation.",
  setup_failed: "GitHub setup could not be verified. Start the installation again from this project.",
  session_expired: "Your DevFlow session expired during GitHub setup. Sign in again, then reconnect.",
  authorization_failed: "GitHub authorization did not complete. Please start the connection again.",
  installation_unverified: "GitHub could not verify your access to that installation. Make sure you installed the DevFlow App with the account you authorized.",
  repositories_unavailable: "GitHub connected, but its selected repositories could not be loaded. Try managing repository access again.",
  save_failed: "GitHub connected, but DevFlow could not save the repository list. Try again.",
  connection_failed: "GitHub connection failed. Please try again.",
};

export function GithubWorkspace({ projectId, canManage, githubStatus }: { projectId: string; canManage: boolean; githubStatus?: string }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [installation, setInstallation] = useState<Installation>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    try {
      const response = await fetch(`/api/projects/${projectId}/github`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not load GitHub repositories.");
      setRepos(result.data as Repo[]);
      setInstallation(result.installation as Installation);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load GitHub repositories."); }
  }
  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${projectId}/github`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not load GitHub repositories.");
      if (active) { setRepos(result.data as Repo[]); setInstallation(result.installation as Installation); }
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Could not load GitHub repositories.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);
  async function connect(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/github`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not connect repository.");
      setUrl(""); setLoading(true); await load(); setLoading(false);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not connect repository."); }
    finally { setBusy(false); }
  }
  async function disconnect(repositoryId: string) {
    const response = await fetch(`/api/projects/${projectId}/github`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repositoryId }) });
    if (!response.ok) { setError("Could not disconnect repository."); return; }
    setRepos((current) => current.filter((repo) => repo.id !== repositoryId));
  }
  async function syncRepositories() {
    setSyncing(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/github/sync`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not sync GitHub repositories.");
      await load();
      const count = Number(result.data?.syncedCount ?? 0);
      if (count === 0) setError("GitHub reports zero repositories for this installation. Confirm the private repos are selected under the account where the App is installed.");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not sync GitHub repositories.");
    } finally { setSyncing(false); }
  }
  return <div className="space-y-6">
    {githubStatus && githubMessages[githubStatus] ? <p className={githubStatus === "connected" ? "rounded-md border border-green-600/30 bg-green-600/5 p-3 text-sm" : "text-destructive rounded-md border border-destructive/30 p-3 text-sm"} role="status">{githubMessages[githubStatus]}</p> : null}
    {canManage ? <section className="bg-card flex flex-col items-start justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
      <div><h2 className="font-medium">GitHub App access</h2><p className="text-muted-foreground mt-1 text-sm">{installation ? `Connected to ${installation.account_type.toLowerCase()} account ${installation.account_login}. ${repos.length} ${repos.length === 1 ? "repository" : "repositories"} linked.` : "Install the DevFlow GitHub App for your account or organization to access selected private repositories."}</p></div>
      <div className="flex flex-wrap gap-2">
        {installation ? <Button disabled={syncing} onClick={() => void syncRepositories()} type="button" variant="outline">{syncing ? "Syncing…" : "Sync repositories"}</Button> : null}
        <Button asChild variant={installation ? "outline" : "default"}><a href={`/api/projects/${projectId}/github/connect`}>{installation ? "Manage repository access" : "Install GitHub App"}</a></Button>
      </div>
    </section> : null}
    {canManage ? <form className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row" onSubmit={connect}>
      <Input aria-label="GitHub repository URL" onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/owner/repository" required type="url" value={url} />
      <Button disabled={busy || !url.trim()} type="submit"><Plus className="size-4" />{busy ? "Connecting…" : "Connect repository"}</Button>
    </form> : null}
    {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
    {loading ? <p className="text-muted-foreground text-sm">Loading GitHub activity…</p> : repos.length ? repos.map((repo) => <article className="bg-card space-y-5 rounded-lg border p-4 sm:p-5" key={repo.id}>
      <header className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="flex items-center gap-2 font-semibold"><GitBranch className="size-4" />{repo.owner}/{repo.repo}</h2><Link className="text-primary mt-1 inline-flex items-center gap-1 text-xs" href={repo.html_url} rel="noreferrer" target="_blank">Open on GitHub <ExternalLink className="size-3" /></Link></div>{canManage ? <Button aria-label={`Disconnect ${repo.owner}/${repo.repo}`} onClick={() => void disconnect(repo.id)} size="icon" type="button" variant="ghost"><Trash2 className="size-4" /></Button> : null}</header>
      {repo.accessError ? <p className="rounded-md border border-amber-600/30 bg-amber-600/5 p-3 text-sm" role="status">{repo.accessError}</p> : null}
      <div className="grid gap-5 lg:grid-cols-3">
        <GithubList title="Recent commits" icon={<GitCommitHorizontal className="size-4" />} items={repo.commits} kind="commit" />
        <GithubList title="Pull requests" icon={<GitPullRequest className="size-4" />} items={repo.pullRequests} kind="pull request" />
        <GithubList title="Repository issues" icon={<span className="text-sm">#</span>} items={repo.issues} kind="issue" />
      </div>
    </article>) : <div className="rounded-lg border border-dashed p-8 text-center"><GitBranch className="text-muted-foreground mx-auto size-8" /><h2 className="mt-3 font-medium">{installation ? "No repositories selected" : "No repository connected"}</h2><p className="text-muted-foreground mt-1 text-sm">{installation ? "Manage the GitHub App installation and grant it access to the private repository you want to connect." : "Connect a public GitHub repository to see recent commits, pull requests, and issues here, or install the GitHub App for private repositories."}</p></div>}
  </div>;
}
function GithubList({ title, icon, items, kind }: { title: string; icon: ReactNode; items: GithubItem[]; kind: string }) {
  return <section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3>{items.length ? <ul className="space-y-2">{items.slice(0, 8).map((item, index) => {
    const href = item.html_url ?? `https://github.com/${item.url ?? ""}`;
    const text = item.commit?.message?.split("\n")[0] ?? item.title ?? item.sha?.slice(0, 8) ?? `${kind} ${index + 1}`;
    return <li className="text-sm" key={item.sha ?? item.url ?? item.html_url ?? index}><Link className="hover:text-primary line-clamp-2" href={href} rel="noreferrer" target="_blank">{text}</Link><span className="text-muted-foreground mt-0.5 block text-xs">{item.user?.login ?? item.commit?.author?.date?.slice(0, 10) ?? item.state ?? "GitHub"}</span></li>;
  })}</ul> : <p className="text-muted-foreground text-xs">No recent {kind}s.</p>}</section>;
}
