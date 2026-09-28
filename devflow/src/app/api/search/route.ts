import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/http/api-response";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const query =
    request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (query.length < 2) return NextResponse.json({ data: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const { data: memberships, error: membershipError } = await supabase
    .from("project_members")
    .select("project_id, user_id")
    .eq("user_id", user.id);
  if (membershipError)
    return apiError("Could not search your workspace", "SEARCH_FAILED", 500);

  const projectIds = [
    ...new Set((memberships ?? []).map((row) => row.project_id)),
  ];
  if (!projectIds.length) return NextResponse.json({ data: [] });

  const pattern = `%${query.replace(/[%,_]/g, " ")}%`;
  const [projectsResult, tasksResult, issuesResult, membersResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds)
        .limit(100),
      supabase
        .from("tasks")
        .select("id, project_id, title")
        .in("project_id", projectIds)
        .ilike("title", pattern)
        .limit(8),
      supabase
        .from("issues")
        .select("id, project_id, issue_number, title")
        .in("project_id", projectIds)
        .ilike("title", pattern)
        .limit(8),
      supabase
        .from("project_members")
        .select("project_id, user_id")
        .in("project_id", projectIds),
    ]);

  if (
    projectsResult.error ||
    tasksResult.error ||
    issuesResult.error ||
    membersResult.error
  )
    return apiError("Could not search your workspace", "SEARCH_FAILED", 500);

  const memberProjectByUser = new Map<string, string>();
  for (const membership of membersResult.data ?? []) {
    if (membership.user_id !== user.id)
      memberProjectByUser.set(membership.user_id, membership.project_id);
  }
  const memberProfileIds = [...memberProjectByUser.keys()];
  const { data: profiles, error: profilesError } = memberProfileIds.length
    ? await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", memberProfileIds)
        .limit(100)
    : { data: [], error: null };
  if (profilesError)
    return apiError("Could not search your workspace", "SEARCH_FAILED", 500);

  const projectNames = new Map(
    (projectsResult.data ?? []).map((project) => [project.id, project.name])
  );
  const matchingProjects = (projectsResult.data ?? [])
    .filter((project) =>
      project.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    )
    .slice(0, 5);
  const matchingProfiles = (profiles ?? [])
    .filter((profile) =>
      `${profile.full_name ?? ""} ${profile.email}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
    )
    .slice(0, 8);
  const results = [
    ...matchingProjects.map((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      detail: "Project",
      href: `/projects/${project.id}`,
    })),
    ...(tasksResult.data ?? []).map((task) => ({
      id: `task:${task.id}`,
      label: task.title,
      detail: `Task · ${projectNames.get(task.project_id) ?? "Project"}`,
      href: `/projects/${task.project_id}/board`,
    })),
    ...(issuesResult.data ?? []).map((issue) => ({
      id: `issue:${issue.id}`,
      label: `#${issue.issue_number} ${issue.title}`,
      detail: `Issue · ${projectNames.get(issue.project_id) ?? "Project"}`,
      href: `/projects/${issue.project_id}/issues`,
    })),
    ...matchingProfiles.flatMap((profile) => {
      const projectId = memberProjectByUser.get(profile.id);
      return projectId
        ? [
            {
              id: `member:${profile.id}`,
              label: profile.full_name || profile.email,
              detail: `Member · ${projectNames.get(projectId) ?? "Project"}`,
              href: `/projects/${projectId}/members`,
            },
          ]
        : [];
    }),
  ];

  return NextResponse.json({ data: results.slice(0, 20) });
}
