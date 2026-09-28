import { notFound } from "next/navigation";
import { IssueList } from "@/components/projects/issue-list";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { listProjectIssues } from "@/lib/services/collaborationService";
import { listProjectLabels } from "@/lib/services/taskService";
import { createClient } from "@/lib/supabase/server";
import type { TaskPerson } from "@/lib/types/task-board";

type MemberRow = {
  user_id: string;
  profile:
    | { id: string; email: string; full_name: string | null }
    | { id: string; email: string; full_name: string | null }[]
    | null;
};

export default async function ProjectIssuesPage({
  params,
}: PageProps<"/projects/[projectId]/issues">) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();
  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) notFound();
  const [issuesResult, labelsResult, membersResult] = await Promise.allSettled([
    listProjectIssues(supabase, projectId),
    listProjectLabels(supabase, projectId),
    supabase
      .from("project_members")
      .select("user_id, profile:users(id, email, full_name)")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true }),
  ]);
  const memberRows =
    membersResult.status === "fulfilled"
      ? ((membersResult.value.data ?? []) as unknown as MemberRow[])
      : [];
  const members: TaskPerson[] = memberRows.flatMap((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return profile
      ? [{ id: profile.id, email: profile.email, fullName: profile.full_name }]
      : [];
  });
  return (
    <IssueList
      canEdit={permissions.createIssue(role)}
      currentUserId={user.id}
      initialIssues={
        issuesResult.status === "fulfilled" ? issuesResult.value : []
      }
      labels={labelsResult.status === "fulfilled" ? labelsResult.value : []}
      loadError={
        issuesResult.status === "rejected" ||
        labelsResult.status === "rejected" ||
        membersResult.status === "rejected" ||
        (membersResult.status === "fulfilled" &&
          Boolean(membersResult.value.error))
      }
      members={members}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
