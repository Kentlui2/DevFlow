import { notFound } from "next/navigation";
import { TaskBoard } from "@/components/tasks/task-board";
import { getProjectRole } from "@/lib/auth/project-access";
import { permissions } from "@/lib/auth/permissions";
import { listProjectLabels } from "@/lib/services/taskService";
import { listProjectTasks } from "@/lib/services/taskService";
import { getProjectSprintWorkspace } from "@/lib/services/sprintService";
import { createClient } from "@/lib/supabase/server";
import type { ProjectTaskLabel, TaskPerson } from "@/lib/types/task-board";

type ProjectMemberRow = {
  user_id: string;
  profile:
    | { id: string; email: string; full_name: string | null }
    | { id: string; email: string; full_name: string | null }[]
    | null;
};

export default async function ProjectBoardPage({
  params,
}: PageProps<"/projects/[projectId]/board">) {
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

  const [tasksResult, labelsResult] = await Promise.allSettled([
    listProjectTasks(supabase, projectId),
    listProjectLabels(supabase, projectId),
  ]);
  const sprintWorkspaceResult = getProjectSprintWorkspace(supabase, projectId);
  const [sprintWorkspaceSettled, membersResult] = await Promise.allSettled([
    sprintWorkspaceResult,
    supabase
      .from("project_members")
      .select("user_id, profile:users(id, email, full_name)")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true }),
  ]);

  const sprintWorkspace =
    sprintWorkspaceSettled.status === "fulfilled"
      ? sprintWorkspaceSettled.value
      : { tasks: [], sprints: [] };
  const taskSprintIds = new Map(
    sprintWorkspace.tasks.map((task) => [task.id, task.sprintId])
  );
  const tasks =
    tasksResult.status === "fulfilled"
      ? tasksResult.value.map((task) => ({
          ...task,
          sprintId: taskSprintIds.get(task.id) ?? null,
        }))
      : [];
  const labels: ProjectTaskLabel[] =
    labelsResult.status === "fulfilled" ? labelsResult.value : [];
  const memberRows =
    membersResult.status === "fulfilled"
      ? ((membersResult.value.data ?? []) as unknown as ProjectMemberRow[])
      : [];
  const members: TaskPerson[] = memberRows.flatMap((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return profile
      ? [{ id: profile.id, email: profile.email, fullName: profile.full_name }]
      : [];
  });
  const loadError =
    tasksResult.status === "rejected" ||
    sprintWorkspaceSettled.status === "rejected" ||
    labelsResult.status === "rejected" ||
    membersResult.status === "rejected" ||
    (membersResult.status === "fulfilled" &&
      Boolean(membersResult.value.error));

  return (
    <div className="space-y-6">
      <TaskBoard
        canEdit={permissions.editTask(role)}
        currentUserId={user.id}
        initialLabels={labels}
        initialTasks={tasks}
        loadError={loadError}
        members={members}
        projectId={project.id}
        projectName={project.name}
        sprints={sprintWorkspace.sprints.map(({ id, name, status }) => ({
          id,
          name,
          status,
        }))}
      />
    </div>
  );
}
