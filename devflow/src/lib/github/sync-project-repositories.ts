import { createClient } from "@/lib/supabase/server";
import { createInstallationToken, githubApiHeaders } from "@/lib/github/app-auth";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type InstallationRepository = { id: number; name: string; html_url: string; owner: { login: string } };

export async function syncProjectGithubRepositories(
  supabase: Supabase,
  projectId: string,
  installationId: number,
  userId: string,
) {
  const token = await createInstallationToken(installationId);
  const repositories: InstallationRepository[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`https://api.github.com/installation/repositories?per_page=100&page=${page}`, {
      headers: githubApiHeaders(token), cache: "no-store",
    });
    if (!response.ok) throw new Error(`GitHub could not list this installation's repositories (${response.status}).`);
    const batch = (await response.json() as { repositories?: InstallationRepository[] }).repositories ?? [];
    repositories.push(...batch);
    if (batch.length < 100) break;
  }

  for (let start = 0; start < repositories.length; start += 100) {
    const rows = repositories.slice(start, start + 100).map((repository) => ({
      project_id: projectId,
      github_id: repository.id,
      installation_id: installationId,
      owner: repository.owner.login,
      repo: repository.name,
      html_url: repository.html_url,
      linked_by: userId,
    }));
    const { error } = await supabase.from("github_repositories").upsert(rows, { onConflict: "project_id,owner,repo" });
    if (error) throw new Error("DevFlow could not save the GitHub repository list.");
  }

  const { data: current, error: readError } = await supabase.from("github_repositories").select("id, github_id")
    .eq("project_id", projectId).eq("installation_id", installationId);
  if (readError) throw new Error("DevFlow could not check the previously linked repositories.");
  const selectedIds = repositories.map((repository) => repository.id);
  const staleIds = (current ?? []).filter((repository) => !selectedIds.includes(repository.github_id)).map((repository) => repository.id);
  for (let start = 0; start < staleIds.length; start += 100) {
    const { error } = await supabase.from("github_repositories").delete().eq("project_id", projectId)
      .in("id", staleIds.slice(start, start + 100));
    if (error) throw new Error("DevFlow could not remove repositories that are no longer granted to the App.");
  }
  return repositories.length;
}
