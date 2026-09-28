import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sprint, SprintStatus } from "@/lib/types";
import type { TaskBoardItem } from "@/lib/types/task-board";
import type {
  CreateSprintInput,
  UpdateSprintInput,
} from "@/lib/validation/sprint";
import { listProjectTasks } from "@/lib/services/taskService";

type SprintRow = {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  created_at: string;
  updated_at: string;
};

export type SprintWithTasks = Sprint & { tasks: TaskBoardItem[] };

export async function getProjectSprintWorkspace(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ sprints: SprintWithTasks[]; tasks: TaskBoardItem[] }> {
  const [sprintResult, taskResult] = await Promise.all([
    supabase
      .from("sprints")
      .select(
        "id, project_id, name, start_date, end_date, status, created_at, updated_at"
      )
      .eq("project_id", projectId)
      .order("start_date", { ascending: false }),
    listProjectTasks(supabase, projectId),
  ]);
  if (sprintResult.error) throw sprintResult.error;

  const rows = (sprintResult.data ?? []) as SprintRow[];
  const sprintIds = rows.map((sprint) => sprint.id);
  const linksResult = sprintIds.length
    ? await supabase
        .from("sprint_tasks")
        .select("sprint_id, task_id")
        .in("sprint_id", sprintIds)
    : { data: [], error: null };
  if (linksResult.error) throw linksResult.error;

  const tasksById = new Map(taskResult.map((task) => [task.id, task]));
  const tasksBySprint = new Map<string, TaskBoardItem[]>();
  const sprintIdByTask = new Map<string, string>();
  for (const link of linksResult.data ?? []) {
    const task = tasksById.get(link.task_id);
    if (!task) continue;
    sprintIdByTask.set(task.id, link.sprint_id);
    tasksBySprint.set(link.sprint_id, [
      ...(tasksBySprint.get(link.sprint_id) ?? []),
      task,
    ]);
  }

  return {
    sprints: rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tasks: tasksBySprint.get(row.id) ?? [],
    })),
    tasks: taskResult.map((task) => ({
      ...task,
      sprintId: sprintIdByTask.get(task.id) ?? null,
    })),
  };
}

export async function createSprint(
  supabase: SupabaseClient,
  projectId: string,
  createdBy: string,
  input: CreateSprintInput
): Promise<Sprint> {
  const { data, error } = await supabase
    .from("sprints")
    .insert({
      project_id: projectId,
      created_by: createdBy,
      name: input.name,
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .select(
      "id, project_id, name, start_date, end_date, status, created_at, updated_at"
    )
    .single();
  if (error) throw error;
  return mapSprint(data as SprintRow);
}

export async function updateSprint(
  supabase: SupabaseClient,
  projectId: string,
  sprintId: string,
  input: UpdateSprintInput
): Promise<Sprint | null> {
  const existing = await getSprint(supabase, projectId, sprintId);
  if (!existing) return null;
  if (existing.status === "completed")
    throw new Error("SPRINT_ALREADY_COMPLETED");
  const mergedStartDate = input.startDate ?? existing.startDate;
  const mergedEndDate = input.endDate ?? existing.endDate;
  if (mergedEndDate < mergedStartDate)
    throw new Error("SPRINT_END_DATE_BEFORE_START_DATE");
  if (existing.status !== "planned" && (input.startDate || input.endDate))
    throw new Error("SPRINT_DATES_LOCKED_AFTER_START");
  if (input.status && input.status !== existing.status) {
    const validTransition =
      (existing.status === "planned" && input.status === "active") ||
      (existing.status === "active" && input.status === "completed");
    if (!validTransition) throw new Error("SPRINT_STATUS_TRANSITION_INVALID");
  }

  const update: Record<string, string> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.startDate !== undefined) update.start_date = input.startDate;
  if (input.endDate !== undefined) update.end_date = input.endDate;
  if (input.status !== undefined) update.status = input.status;
  const { data, error } = await supabase
    .from("sprints")
    .update(update)
    .eq("project_id", projectId)
    .eq("id", sprintId)
    .select(
      "id, project_id, name, start_date, end_date, status, created_at, updated_at"
    )
    .maybeSingle();
  if (error) throw error;
  return data ? mapSprint(data as SprintRow) : null;
}

export async function deleteSprint(
  supabase: SupabaseClient,
  projectId: string,
  sprintId: string
) {
  const { data, error } = await supabase
    .from("sprints")
    .delete()
    .eq("project_id", projectId)
    .eq("id", sprintId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function addTasksToSprint(
  supabase: SupabaseClient,
  projectId: string,
  sprintId: string,
  taskIds: string[]
) {
  const uniqueTaskIds = [...new Set(taskIds)];
  const sprint = await getSprint(supabase, projectId, sprintId);
  if (!sprint) return false;
  if (sprint.status === "completed")
    throw new Error("CANNOT_ADD_TASK_TO_COMPLETED_SPRINT");

  const { data: tasks, error: taskError } = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", projectId)
    .in("id", uniqueTaskIds);
  if (taskError) throw taskError;
  if ((tasks ?? []).length !== uniqueTaskIds.length)
    throw new Error("SPRINT_TASK_MUST_BELONG_TO_PROJECT");

  const { error } = await supabase
    .from("sprint_tasks")
    .insert(
      uniqueTaskIds.map((taskId) => ({ sprint_id: sprintId, task_id: taskId }))
    );
  if (error) throw error;
  return true;
}

export async function removeTaskFromSprint(
  supabase: SupabaseClient,
  projectId: string,
  sprintId: string,
  taskId: string
) {
  const sprint = await getSprint(supabase, projectId, sprintId);
  if (!sprint) return false;
  if (sprint.status === "completed")
    throw new Error("SPRINT_ALREADY_COMPLETED");
  const { data, error } = await supabase
    .from("sprint_tasks")
    .delete()
    .eq("sprint_id", sprintId)
    .eq("task_id", taskId)
    .select("task_id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function getSprint(
  supabase: SupabaseClient,
  projectId: string,
  sprintId: string
): Promise<Sprint | null> {
  const { data, error } = await supabase
    .from("sprints")
    .select(
      "id, project_id, name, start_date, end_date, status, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .eq("id", sprintId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSprint(data as SprintRow) : null;
}

function mapSprint(row: SprintRow): Sprint {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
