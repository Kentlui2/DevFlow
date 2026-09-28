"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ExternalLink, GitBranch, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Repo = { id: string; owner: string; repo: string };
type GithubLink = { id: string; link_type: string; html_url: string; title: string };
export function TaskGithubLinks({ projectId, taskId, canEdit }: { projectId: string; taskId: string; canEdit: boolean }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [links, setLinks] = useState<GithubLink[]>([]);
  const [repositoryId, setRepositoryId] = useState("");
  const [type, setType] = useState("pull_request");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/projects/${projectId}/github?metadata=1`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/tasks/${taskId}/github-links`).then((r) => r.json()),
    ]).then(([repositories, taskLinks]) => {
      if (!active) return;
      const available = (repositories.data ?? []) as Repo[];
      setRepos(available); setRepositoryId((current) => current || available[0]?.id || "");
      setLinks((taskLinks.data ?? []) as GithubLink[]);
    }).catch(() => { if (active) setError("Could not load GitHub links."); });
    return () => { active = false; };
  }, [projectId, taskId]);
  async function add(event: FormEvent) {
    event.preventDefault(); setError(null);
    const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}/github-links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repositoryId, type, url, title }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error?.message ?? "Could not link this GitHub item."); return; }
    setLinks((current) => [result.data as GithubLink, ...current]); setUrl(""); setTitle("");
  }
  async function remove(id: string) {
    await fetch(`/api/projects/${projectId}/tasks/${taskId}/github-links?linkId=${id}`, { method: "DELETE" });
    setLinks((current) => current.filter((link) => link.id !== id));
  }
  return <section className="mt-4 border-t pt-4"><h3 className="flex items-center gap-2 text-sm font-medium"><GitBranch className="size-4" /> GitHub links</h3>
    {links.length ? <ul className="mt-2 space-y-1">{links.map((link) => <li className="flex items-center gap-2 text-sm" key={link.id}><Link className="text-primary min-w-0 flex-1 truncate" href={link.html_url} rel="noreferrer" target="_blank">{link.title} <span className="text-muted-foreground">({link.link_type.replace("_", " ")})</span></Link><ExternalLink className="size-3 shrink-0" />{canEdit ? <Button aria-label={`Remove ${link.title}`} onClick={() => void remove(link.id)} size="icon" type="button" variant="ghost"><Trash2 className="size-4" /></Button> : null}</li>)}</ul> : <p className="text-muted-foreground mt-2 text-xs">No commits, pull requests, or issues linked yet.</p>}
    {canEdit && repos.length ? <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={add}>
      <select aria-label="GitHub repository" className="border-input bg-background h-9 rounded-md border px-3 text-sm" onChange={(event) => setRepositoryId(event.target.value)} value={repositoryId}>{repos.map((repo) => <option key={repo.id} value={repo.id}>{repo.owner}/{repo.repo}</option>)}</select>
      <select aria-label="GitHub item type" className="border-input bg-background h-9 rounded-md border px-3 text-sm" onChange={(event) => setType(event.target.value)} value={type}><option value="pull_request">Pull request</option><option value="commit">Commit</option><option value="issue">Issue</option></select>
      <Input aria-label="GitHub item URL" onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/owner/repo/pull/12" required type="url" value={url} />
      <div className="flex gap-2"><Input aria-label="Link title" onChange={(event) => setTitle(event.target.value)} placeholder="Short description" required value={title} /><Button disabled={!repositoryId} type="submit">Link</Button></div>
      {error ? <p className="text-destructive text-xs sm:col-span-2" role="alert">{error}</p> : null}
    </form> : canEdit ? <p className="text-muted-foreground mt-2 text-xs">Connect a repository on the project’s GitHub page to link work here.</p> : null}
  </section>;
}
