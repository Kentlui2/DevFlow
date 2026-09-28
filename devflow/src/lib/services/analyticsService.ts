import type { SupabaseClient } from "@supabase/supabase-js";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/types/task-board";
import type { IssueStatus } from "@/lib/types/collaboration";
import type { SprintStatus, TaskPriority, TaskStatus } from "@/lib/types";

type TaskRow = {
  id: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
};

type IssueRow = { status: IssueStatus };
type SprintRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SprintStatus;
};
type SprintTaskRow = { sprint_id: string; task_id: string };
type MemberRow = {
  user_id: string;
  profile:
    | { id: string; email: string; full_name: string | null }
    | { id: string; email: string; full_name: string | null }[]
    | null;
};

export type AnalyticsBar = { key: string; label: string; value: number };
export type SprintVelocityPoint = {
  id: string;
  name: string;
  completed: number;
  scope: number;
};
export type MemberWorkload = {
  id: string;
  name: string;
  assigned: number;
  active: number;
  inProgress: number;
  completed: number;
};

export type ProjectAnalytics = {
  totalTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  tasksByStatus: AnalyticsBar[];
  tasksByPriority: AnalyticsBar[];
  totalIssues: number;
  unresolvedIssues: number;
  resolvedIssues: number;
  issuesByStatus: AnalyticsBar[];
  activeSprint: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    scope: number;
    completed: number;
    progress: number;
  } | null;
  completedSprintCount: number;
  historicalSprintScope: number;
  historicalSprintCompleted: number;
  historicalSprintCompletionRate: number;
  historicalSprintCount: number;
  averageVelocity: number;
  velocityPoints: SprintVelocityPoint[];
  workload: MemberWorkload[];
  activityLast30Days: number;
  activityByWeek: AnalyticsBar[];
};

export async function getProjectAnalytics(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectAnalytics> {
  const activitySince = getActivityWindowStart();
  const [
    tasksResult,
    issuesResult,
    sprintsResult,
    membersResult,
    activitiesResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, status, priority, assignee_id")
      .eq("project_id", projectId),
    supabase.from("issues").select("status").eq("project_id", projectId),
    supabase
      .from("sprints")
      .select("id, name, start_date, end_date, status")
      .eq("project_id", projectId),
    supabase
      .from("project_members")
      .select("user_id, profile:users(id, email, full_name)")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("activities")
      .select("created_at")
      .eq("project_id", projectId)
      .gte("created_at", activitySince),
  ]);

  if (tasksResult.error) throw tasksResult.error;
  if (issuesResult.error) throw issuesResult.error;
  if (sprintsResult.error) throw sprintsResult.error;
  if (membersResult.error) throw membersResult.error;
  if (activitiesResult.error) throw activitiesResult.error;

  const tasks = (tasksResult.data ?? []) as TaskRow[];
  const issues = (issuesResult.data ?? []) as IssueRow[];
  const sprints = (sprintsResult.data ?? []) as SprintRow[];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const sprintIds = sprints.map((sprint) => sprint.id);
  const linksResult = sprintIds.length
    ? await supabase
        .from("sprint_tasks")
        .select("sprint_id, task_id")
        .in("sprint_id", sprintIds)
    : { data: [], error: null };
  if (linksResult.error) throw linksResult.error;

  const taskIdsBySprint = new Map<string, string[]>();
  for (const link of (linksResult.data ?? []) as SprintTaskRow[]) {
    taskIdsBySprint.set(link.sprint_id, [
      ...(taskIdsBySprint.get(link.sprint_id) ?? []),
      link.task_id,
    ]);
  }

  const tasksByStatus = TASK_STATUSES.map(({ value, label }) => ({
    key: value,
    label,
    value: tasks.filter((task) => task.status === value).length,
  }));
  const tasksByPriority = TASK_PRIORITIES.map(({ value, label }) => ({
    key: value,
    label,
    value: tasks.filter((task) => task.priority === value).length,
  }));
  const issuesByStatus: AnalyticsBar[] = [
    {
      key: "open",
      label: "Open",
      value: issues.filter((issue) => issue.status === "open").length,
    },
    {
      key: "in_progress",
      label: "In progress",
      value: issues.filter((issue) => issue.status === "in_progress").length,
    },
    {
      key: "resolved",
      label: "Resolved",
      value: issues.filter((issue) => issue.status === "resolved").length,
    },
    {
      key: "closed",
      label: "Closed",
      value: issues.filter((issue) => issue.status === "closed").length,
    },
  ];
  const completedTasks =
    tasksByStatus.find((status) => status.key === "done")?.value ?? 0;
  const activeSprintRow = sprints.find((sprint) => sprint.status === "active");
  const activeSprintTasks = activeSprintRow
    ? (taskIdsBySprint.get(activeSprintRow.id) ?? [])
        .map((id) => taskById.get(id))
        .filter((task): task is TaskRow => Boolean(task))
    : [];
  const activeSprintCompleted = activeSprintTasks.filter(
    (task) => task.status === "done"
  ).length;
  const activeSprint = activeSprintRow
    ? {
        id: activeSprintRow.id,
        name: activeSprintRow.name,
        startDate: activeSprintRow.start_date,
        endDate: activeSprintRow.end_date,
        scope: activeSprintTasks.length,
        completed: activeSprintCompleted,
        progress: activeSprintTasks.length
          ? Math.round((activeSprintCompleted / activeSprintTasks.length) * 100)
          : 0,
      }
    : null;

  const completedSprints = sprints
    .filter((sprint) => sprint.status === "completed")
    .map((sprint) => {
      const scopedTasks = (taskIdsBySprint.get(sprint.id) ?? [])
        .map((id) => taskById.get(id))
        .filter((task): task is TaskRow => Boolean(task));
      return {
        id: sprint.id,
        name: sprint.name,
        completed: scopedTasks.filter((task) => task.status === "done").length,
        scope: scopedTasks.length,
        endDate: sprint.end_date,
      };
    })
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const historicalSprints = completedSprints.filter(
    (sprint) => sprint.scope > 0
  );
  const recentSprints = historicalSprints.slice(-5);
  const historicalSprintScope = historicalSprints.reduce(
    (sum, sprint) => sum + sprint.scope,
    0
  );
  const historicalSprintCompleted = historicalSprints.reduce(
    (sum, sprint) => sum + sprint.completed,
    0
  );
  const velocityPoints = recentSprints.map(
    ({ id, name, completed, scope }) => ({
      id,
      name,
      completed,
      scope,
    })
  );

  const members = ((membersResult.data ?? []) as unknown as MemberRow[]).map(
    (row) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      return {
        id: row.user_id,
        name: profile?.full_name || profile?.email || "Project member",
      };
    }
  );
  const workloadById = new Map<string, MemberWorkload>(
    members.map((member) => [
      member.id,
      {
        ...member,
        assigned: 0,
        active: 0,
        inProgress: 0,
        completed: 0,
      },
    ])
  );
  const unassigned: MemberWorkload = {
    id: "unassigned",
    name: "Unassigned",
    assigned: 0,
    active: 0,
    inProgress: 0,
    completed: 0,
  };
  const formerMember: MemberWorkload = {
    id: "former-member",
    name: "Removed member",
    assigned: 0,
    active: 0,
    inProgress: 0,
    completed: 0,
  };
  for (const task of tasks) {
    const member = task.assignee_id
      ? workloadById.get(task.assignee_id)
      : undefined;
    const target = member ?? (task.assignee_id ? formerMember : unassigned);
    target.assigned += 1;
    if (task.status === "done") target.completed += 1;
    else target.active += 1;
    if (task.status === "in_progress" || task.status === "in_review")
      target.inProgress += 1;
  }
  const workload = [...workloadById.values()];
  if (unassigned.assigned) workload.push(unassigned);
  if (formerMember.assigned) workload.push(formerMember);
  workload.sort(
    (a, b) =>
      b.active - a.active ||
      b.assigned - a.assigned ||
      a.name.localeCompare(b.name)
  );

  return {
    totalTasks: tasks.length,
    completedTasks,
    taskCompletionRate: tasks.length
      ? Math.round((completedTasks / tasks.length) * 100)
      : 0,
    tasksByStatus,
    tasksByPriority,
    totalIssues: issues.length,
    unresolvedIssues: issues.filter(
      (issue) => issue.status === "open" || issue.status === "in_progress"
    ).length,
    resolvedIssues: issues.filter(
      (issue) => issue.status === "resolved" || issue.status === "closed"
    ).length,
    issuesByStatus,
    activeSprint,
    completedSprintCount: completedSprints.length,
    historicalSprintScope,
    historicalSprintCompleted,
    historicalSprintCompletionRate: historicalSprintScope
      ? Math.round((historicalSprintCompleted / historicalSprintScope) * 100)
      : 0,
    historicalSprintCount: historicalSprints.length,
    averageVelocity: recentSprints.length
      ? Math.round(
          (recentSprints.reduce((sum, sprint) => sum + sprint.completed, 0) /
            recentSprints.length) *
            10
        ) / 10
      : 0,
    velocityPoints,
    workload,
    activityLast30Days: (activitiesResult.data ?? []).filter(
      (activity) =>
        new Date(activity.created_at).getTime() >=
        Date.now() - 30 * 24 * 60 * 60 * 1000
    ).length,
    activityByWeek: buildActivityBars(
      (activitiesResult.data ?? []).map((activity) => activity.created_at)
    ),
  };
}

function buildActivityBars(dates: string[]): AnalyticsBar[] {
  const now = new Date();
  const currentMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const dayOfWeek = currentMonday.getUTCDay();
  currentMonday.setUTCDate(currentMonday.getUTCDate() - ((dayOfWeek + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(currentMonday);
    start.setUTCDate(currentMonday.getUTCDate() - 7 * (7 - index));
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    return { start, end, value: 0 };
  });
  for (const date of dates) {
    const timestamp = new Date(date).getTime();
    const week = weeks.find(
      ({ start, end }) =>
        timestamp >= start.getTime() && timestamp < end.getTime()
    );
    if (week) week.value += 1;
  }
  return weeks.map(({ start, value }, index) => ({
    key: start.toISOString(),
    label:
      index === weeks.length - 1
        ? "This week"
        : start.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }),
    value,
  }));
}

function getActivityWindowStart() {
  const now = new Date();
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) - 49);
  return monday.toISOString();
}
