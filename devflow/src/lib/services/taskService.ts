import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateLabelInput,
  CreateTaskInput,
  TaskFilters,
  UpdateTaskInput,
} from "@/lib/validation/task";
import type {
  ProjectTaskLabel,
  TaskBoardItem,
  TaskLabel,
  TaskPerson,
} from "@/lib/types/task-board";

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskBoardItem["status"];
  priority: TaskBoardItem["priority"];
  assignee_id: string | null;
  created_by: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export async function listProjectTasks(
  supabase: SupabaseClient,
  projectId: string,
  filters: TaskFilters = {}
): Promise<TaskBoardItem[]> {
  let query = supabase
    .from("tasks")
    .select(
      "id, project_id, title, description, status, priority, assignee_id, created_by, due_date, created_at, updated_at"
    )
    .eq("project_id", projectId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.assigneeId === "unassigned")
    query = query.is("assignee_id", null);
  else if (filters.assigneeId)
    query = query.eq("assignee_id", filters.assigneeId);

  if (filters.labelId) {
    const { data: linkedTasks, error: linkError } = await supabase
      .from("task_labels")
      .select("task_id")
      .eq("label_id", filters.labelId);
    if (linkError) throw linkError;
    const taskIds = [...new Set((linkedTasks ?? []).map((row) => row.task_id))];
    if (!taskIds.length) return [];
    query = query.in("id", taskIds);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  let rows = (data ?? []) as TaskRow[];
  if (filters.search) {
    const search = filters.search.toLocaleLowerCase();
    rows = rows.filter((task) =>
      `${task.title} ${task.description ?? ""}`
        .toLocaleLowerCase()
        .includes(search)
    );
  }
  return attachTaskDetails(supabase, rows);
}

export async function getProjectTask(
  supabase: SupabaseClient,
  projectId: string,
  taskId: string
): Promise<TaskBoardItem | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, project_id, title, description, status, priority, assignee_id, created_by, due_date, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [task] = await attachTaskDetails(supabase, [data as TaskRow]);
  return task;
}

export async function createTask(
  supabase: SupabaseClient,
  projectId: string,
  createdBy: string,
  input: CreateTaskInput
): Promise<TaskBoardItem> {
  await assertProjectLabels(supabase, projectId, input.labelIds ?? []);
  await assertProjectAssignee(supabase, projectId, input.assigneeId ?? null);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title: input.title,
      description: input.description?.trim() || null,
      status: input.status,
      priority: input.priority,
      assignee_id: input.assigneeId ?? null,
      due_date: input.dueDate ?? null,
      created_by: createdBy,
    })
    .select(
      "id, project_id, title, description, status, priority, assignee_id, created_by, due_date, created_at, updated_at"
    )
    .single();
  if (error) throw error;

  try {
    await replaceTaskLabels(supabase, data.id, input.labelIds ?? []);
    const created = await getProjectTask(supabase, projectId, data.id);
    if (!created) throw new Error("CREATED_TASK_NOT_FOUND");
    return created;
  } catch (error) {
    await supabase
      .from("tasks")
      .delete()
      .eq("id", data.id)
      .eq("project_id", projectId);
    throw error;
  }
}

export async function updateTask(
  supabase: SupabaseClient,
  projectId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<TaskBoardItem | null> {
  if (input.labelIds !== undefined)
    await assertProjectLabels(supabase, projectId, input.labelIds);
  if (input.assigneeId !== undefined)
    await assertProjectAssignee(supabase, projectId, input.assigneeId);

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined)
    update.description = input.description?.trim() || null;
  if (input.status !== undefined) update.status = input.status;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.assigneeId !== undefined) update.assignee_id = input.assigneeId;
  if (input.dueDate !== undefined) update.due_date = input.dueDate;

  if (Object.keys(update).length) {
    const { data, error } = await supabase
      .from("tasks")
      .update(update)
      .eq("project_id", projectId)
      .eq("id", taskId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
  }

  if (input.labelIds !== undefined)
    await replaceTaskLabels(supabase, taskId, input.labelIds);
  return getProjectTask(supabase, projectId, taskId);
}

export async function deleteTask(
  supabase: SupabaseClient,
  projectId: string,
  taskId: string
) {
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("project_id", projectId)
    .eq("id", taskId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listProjectLabels(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectTaskLabel[]> {
  const { data, error } = await supabase
    .from("labels")
    .select("id, project_id, name, color")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((label) => ({
    id: label.id,
    projectId: label.project_id,
    name: label.name,
    color: label.color,
  }));
}

export async function createProjectLabel(
  supabase: SupabaseClient,
  projectId: string,
  input: CreateLabelInput
): Promise<ProjectTaskLabel> {
  const { data, error } = await supabase
    .from("labels")
    .insert({ project_id: projectId, name: input.name, color: input.color })
    .select("id, project_id, name, color")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    projectId: data.project_id,
    name: data.name,
    color: data.color,
  };
}

export async function deleteProjectLabel(
  supabase: SupabaseClient,
  projectId: string,
  labelId: string
) {
  const { data, error } = await supabase
    .from("labels")
    .delete()
    .eq("project_id", projectId)
    .eq("id", labelId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function assertProjectLabels(
  supabase: SupabaseClient,
  projectId: string,
  labelIds: string[]
) {
  const ids = [...new Set(labelIds)];
  if (!ids.length) return;
  const { data, error } = await supabase
    .from("labels")
    .select("id")
    .eq("project_id", projectId)
    .in("id", ids);
  if (error) throw error;
  if ((data ?? []).length !== ids.length)
    throw new Error("TASK_LABELS_MUST_BELONG_TO_PROJECT");
}

async function assertProjectAssignee(
  supabase: SupabaseClient,
  projectId: string,
  userId: string | null
) {
  if (!userId) return;
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("TASK_ASSIGNEE_MUST_BE_PROJECT_MEMBER");
}

async function replaceTaskLabels(
  supabase: SupabaseClient,
  taskId: string,
  labelIds: string[]
) {
  const { error } = await supabase.rpc("replace_task_labels", {
    p_task_id: taskId,
    p_label_ids: [...new Set(labelIds)],
  });
  if (error) throw error;
}

async function attachTaskDetails(
  supabase: SupabaseClient,
  rows: TaskRow[]
): Promise<TaskBoardItem[]> {
  if (!rows.length) return [];
  const assigneeIds = [
    ...new Set(
      rows.flatMap((row) => (row.assignee_id ? [row.assignee_id] : []))
    ),
  ];
  const taskIds = rows.map((row) => row.id);
  const [peopleResult, linksResult] = await Promise.all([
    assigneeIds.length
      ? supabase
          .from("users")
          .select("id, email, full_name")
          .in("id", assigneeIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("task_labels")
      .select("task_id, label_id")
      .in("task_id", taskIds),
  ]);
  if (peopleResult.error) throw peopleResult.error;
  if (linksResult.error) throw linksResult.error;

  const labelIds = [
    ...new Set((linksResult.data ?? []).map((link) => link.label_id)),
  ];
  const labelsResult = labelIds.length
    ? await supabase.from("labels").select("id, name, color").in("id", labelIds)
    : { data: [], error: null };
  if (labelsResult.error) throw labelsResult.error;

  const peopleById = new Map<string, TaskPerson>(
    (peopleResult.data ?? []).map((person) => [
      person.id,
      {
        id: person.id,
        email: person.email,
        fullName: person.full_name,
      },
    ])
  );
  const labelsById = new Map<string, TaskLabel>(
    (labelsResult.data ?? []).map((label) => [label.id, label])
  );
  const labelsByTask = new Map<string, TaskLabel[]>();
  for (const link of linksResult.data ?? []) {
    const label = labelsById.get(link.label_id);
    if (label)
      labelsByTask.set(link.task_id, [
        ...(labelsByTask.get(link.task_id) ?? []),
        label,
      ]);
  }

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    createdBy: row.created_by,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignee: row.assignee_id
      ? (peopleById.get(row.assignee_id) ?? null)
      : null,
    labels: labelsByTask.get(row.id) ?? [],
  }));
}
