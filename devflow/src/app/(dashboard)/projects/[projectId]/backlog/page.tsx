import { notFound } from "next/navigation";
import { BacklogWorkspace } from "@/components/projects/backlog-workspace";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { getProjectSprintWorkspace } from "@/lib/services/sprintService";
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

export default async function ProjectBacklogPage({
  params,
}: PageProps<"/projects/[projectId]/backlog">) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const [{ data: project }, role] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle(),
    getProjectRole(supabase, projectId, user.id),
  ]);
  if (!project || !role) notFound();

  const [workspaceResult, labelsResult, membersResult] =
    await Promise.allSettled([
      getProjectSprintWorkspace(supabase, projectId),
      listProjectLabels(supabase, projectId),
      supabase
        .from("project_members")
        .select("user_id, profile:users(id, email, full_name)")
        .eq("project_id", projectId)
        .order("joined_at", { ascending: true }),
    ]);
  const workspace =
    workspaceResult.status === "fulfilled"
      ? workspaceResult.value
      : { sprints: [], tasks: [] };
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
  const sprints = workspace.sprints
    .filter((sprint) => sprint.status !== "completed")
    .map(
      ({
        id,
        projectId: sprintProjectId,
        name,
        startDate,
        endDate,
        status,
        createdAt,
        updatedAt,
      }) => ({
        id,
        projectId: sprintProjectId,
        name,
        startDate,
        endDate,
        status,
        createdAt,
        updatedAt,
      })
    );

  return (
    <BacklogWorkspace
      canManage={permissions.manageSprint(role)}
      initialTasks={workspace.tasks}
      labels={labelsResult.status === "fulfilled" ? labelsResult.value : []}
      loadError={
        workspaceResult.status === "rejected" ||
        labelsResult.status === "rejected" ||
        membersResult.status === "rejected" ||
        (membersResult.status === "fulfilled" &&
          Boolean(membersResult.value.error))
      }
      members={members}
      projectId={project.id}
      projectName={project.name}
      sprints={sprints}
    />
  );
}
