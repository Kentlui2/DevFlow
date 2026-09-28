import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateCommentInput,
  CreateIssueInput,
  IssueFilters,
  UpdateCommentInput,
  UpdateIssueInput,
} from "@/lib/validation/collaboration";
import type {
  ProjectActivity,
  ProjectComment,
  ProjectIssue,
} from "@/lib/types/collaboration";
import type { ProjectTaskLabel, TaskPerson } from "@/lib/types/task-board";

type IssueRow = {
  id: string;
  issue_number: number;
  project_id: string;
  title: string;
  description: string | null;
  status: ProjectIssue["status"];
  priority: ProjectIssue["priority"];
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function listProjectIssues(
  supabase: SupabaseClient,
  projectId: string,
  filters: IssueFilters = {}
): Promise<ProjectIssue[]> {
  let query = supabase
    .from("issues")
    .select(
      "id, issue_number, project_id, title, description, status, priority, assignee_id, created_by, created_at, updated_at"
    )
    .eq("project_id", projectId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.assigneeId === "unassigned")
    query = query.is("assignee_id", null);
  else if (filters.assigneeId)
    query = query.eq("assignee_id", filters.assigneeId);
  if (filters.labelId) {
    const { data, error } = await supabase
      .from("issue_labels")
      .select("issue_id")
      .eq("label_id", filters.labelId);
    if (error) throw error;
    const issueIds = [...new Set((data ?? []).map((row) => row.issue_id))];
    if (!issueIds.length) return [];
    query = query.in("id", issueIds);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  let rows = (data ?? []) as IssueRow[];
  if (filters.search) {
    const search = filters.search.toLocaleLowerCase();
    rows = rows.filter((issue) =>
      `${issue.title} ${issue.description ?? ""}`
        .toLocaleLowerCase()
        .includes(search)
    );
  }
  return attachIssueDetails(supabase, rows);
}

export async function getProjectIssue(
  supabase: SupabaseClient,
  projectId: string,
  issueId: string
): Promise<ProjectIssue | null> {
  const { data, error } = await supabase
    .from("issues")
    .select(
      "id, issue_number, project_id, title, description, status, priority, assignee_id, created_by, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .eq("id", issueId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [issue] = await attachIssueDetails(supabase, [data as IssueRow]);
  return issue;
}

export async function createProjectIssue(
  supabase: SupabaseClient,
  projectId: string,
  createdBy: string,
  input: CreateIssueInput
): Promise<ProjectIssue> {
  await assertProjectIssueDetails(
    supabase,
    projectId,
    input.labelIds ?? [],
    input.assigneeId ?? null
  );
  const { data, error } = await supabase
    .from("issues")
    .insert({
      project_id: projectId,
      title: input.title,
      description: input.description?.trim() || null,
      status: input.status,
      priority: input.priority,
      assignee_id: input.assigneeId ?? null,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) throw error;
  try {
    await replaceIssueLabels(supabase, data.id, input.labelIds ?? []);
    const created = await getProjectIssue(supabase, projectId, data.id);
    if (!created) throw new Error("CREATED_ISSUE_NOT_FOUND");
    return created;
  } catch (error) {
    await supabase
      .from("issues")
      .delete()
      .eq("project_id", projectId)
      .eq("id", data.id);
    throw error;
  }
}

export async function updateProjectIssue(
  supabase: SupabaseClient,
  projectId: string,
  issueId: string,
  input: UpdateIssueInput
): Promise<ProjectIssue | null> {
  if (input.labelIds !== undefined || input.assigneeId !== undefined) {
    await assertProjectIssueDetails(
      supabase,
      projectId,
      input.labelIds ?? [],
      input.assigneeId ?? null
    );
  }
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined)
    update.description = input.description?.trim() || null;
  if (input.status !== undefined) update.status = input.status;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.assigneeId !== undefined) update.assignee_id = input.assigneeId;
  if (Object.keys(update).length) {
    const { data, error } = await supabase
      .from("issues")
      .update(update)
      .eq("project_id", projectId)
      .eq("id", issueId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
  }
  if (input.labelIds !== undefined)
    await replaceIssueLabels(supabase, issueId, input.labelIds);
  return getProjectIssue(supabase, projectId, issueId);
}

export async function deleteProjectIssue(
  supabase: SupabaseClient,
  projectId: string,
  issueId: string
) {
  const { data, error } = await supabase
    .from("issues")
    .delete()
    .eq("project_id", projectId)
    .eq("id", issueId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listComments(
  supabase: SupabaseClient,
  projectId: string,
  commentableType: ProjectComment["commentableType"],
  commentableId: string
): Promise<ProjectComment[]> {
  await assertCommentTarget(
    supabase,
    projectId,
    commentableType,
    commentableId
  );
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, author_id, author_name, commentable_type, commentable_id, body, created_at, updated_at"
    )
    .eq("commentable_type", commentableType)
    .eq("commentable_id", commentableId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const people = await getPeople(
    supabase,
    rows.map((row) => row.author_id)
  );
  return rows.flatMap((row) => {
    const author = people.get(row.author_id) ?? {
      id: row.author_id,
      email: "",
      fullName: row.author_name ?? "Former project member",
    };
    return [
      {
        id: row.id,
        projectId,
        authorId: row.author_id,
        author,
        commentableType:
          row.commentable_type as ProjectComment["commentableType"],
        commentableId: row.commentable_id,
        body: row.body,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    ];
  });
}

export async function createComment(
  supabase: SupabaseClient,
  projectId: string,
  authorId: string,
  input: CreateCommentInput
): Promise<ProjectComment> {
  await assertCommentTarget(
    supabase,
    projectId,
    input.commentableType,
    input.commentableId
  );
  const { data, error } = await supabase
    .from("comments")
    .insert({
      author_id: authorId,
      commentable_type: input.commentableType,
      commentable_id: input.commentableId,
      body: input.body,
    })
    .select("id")
    .single();
  if (error) throw error;
  const comments = await listComments(
    supabase,
    projectId,
    input.commentableType,
    input.commentableId
  );
  const created = comments.find((comment) => comment.id === data.id);
  if (!created) throw new Error("CREATED_COMMENT_NOT_FOUND");
  return created;
}

export async function updateComment(
  supabase: SupabaseClient,
  projectId: string,
  commentId: string,
  authorId: string,
  input: UpdateCommentInput
): Promise<ProjectComment | null> {
  const current = await getComment(supabase, projectId, commentId);
  if (!current) return null;
  const { data, error } = await supabase
    .from("comments")
    .update({ body: input.body })
    .eq("id", commentId)
    .eq("author_id", authorId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (
    (
      await listComments(
        supabase,
        projectId,
        current.commentableType,
        current.commentableId
      )
    ).find((comment) => comment.id === commentId) ?? null
  );
}

export async function deleteComment(
  supabase: SupabaseClient,
  projectId: string,
  commentId: string,
  authorId: string
) {
  const current = await getComment(supabase, projectId, commentId);
  if (!current) return false;
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", authorId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function listProjectActivity(
  supabase: SupabaseClient,
  projectId: string,
  limit = 60
): Promise<ProjectActivity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, project_id, actor_id, action_type, entity_type, entity_id, metadata, created_at"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const people = await getPeople(
    supabase,
    rows.map((row) => row.actor_id)
  );
  return rows.flatMap((row) => {
    const actor = people.get(row.actor_id) ?? {
      id: row.actor_id,
      email: "",
      fullName:
        typeof row.metadata?.actor_name === "string"
          ? row.metadata.actor_name
          : "Former project member",
    };
    return [
      {
        id: row.id,
        projectId: row.project_id,
        actorId: row.actor_id,
        actor,
        actionType: row.action_type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        createdAt: row.created_at,
      },
    ];
  });
}

async function getComment(
  supabase: SupabaseClient,
  projectId: string,
  commentId: string
): Promise<ProjectComment | null> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, author_id, author_name, commentable_type, commentable_id, body, created_at, updated_at"
    )
    .eq("id", commentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const type = data.commentable_type as ProjectComment["commentableType"];
  await assertCommentTarget(supabase, projectId, type, data.commentable_id);
  const people = await getPeople(supabase, [data.author_id]);
  const author = people.get(data.author_id) ?? {
    id: data.author_id,
    email: "",
    fullName: data.author_name ?? "Former project member",
  };
  return {
    id: data.id,
    projectId,
    authorId: data.author_id,
    author,
    commentableType: type,
    commentableId: data.commentable_id,
    body: data.body,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

async function assertCommentTarget(
  supabase: SupabaseClient,
  projectId: string,
  type: ProjectComment["commentableType"],
  targetId: string
) {
  const table = type === "task" ? "tasks" : "issues";
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("project_id", projectId)
    .eq("id", targetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("COMMENT_TARGET_NOT_FOUND");
}

async function assertProjectIssueDetails(
  supabase: SupabaseClient,
  projectId: string,
  labelIds: string[],
  assigneeId: string | null
) {
  const uniqueIds = [...new Set(labelIds)];
  if (uniqueIds.length) {
    const { data, error } = await supabase
      .from("labels")
      .select("id")
      .eq("project_id", projectId)
      .in("id", uniqueIds);
    if (error) throw error;
    if ((data ?? []).length !== uniqueIds.length)
      throw new Error("ISSUE_LABELS_MUST_BELONG_TO_PROJECT");
  }
  if (assigneeId) {
    const { data, error } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", assigneeId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("ISSUE_ASSIGNEE_MUST_BE_PROJECT_MEMBER");
  }
}

async function replaceIssueLabels(
  supabase: SupabaseClient,
  issueId: string,
  labelIds: string[]
) {
  const { error } = await supabase.rpc("replace_issue_labels", {
    p_issue_id: issueId,
    p_label_ids: [...new Set(labelIds)],
  });
  if (error) throw error;
}

async function attachIssueDetails(
  supabase: SupabaseClient,
  rows: IssueRow[]
): Promise<ProjectIssue[]> {
  if (!rows.length) return [];
  const assigneeIds = [
    ...new Set(
      rows.flatMap((row) => (row.assignee_id ? [row.assignee_id] : []))
    ),
  ];
  const issueIds = rows.map((row) => row.id);
  const [peopleResult, linksResult] = await Promise.all([
    assigneeIds.length
      ? supabase
          .from("users")
          .select("id, email, full_name")
          .in("id", assigneeIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("issue_labels")
      .select("issue_id, label_id")
      .in("issue_id", issueIds),
  ]);
  if (peopleResult.error) throw peopleResult.error;
  if (linksResult.error) throw linksResult.error;
  const labelIds = [
    ...new Set((linksResult.data ?? []).map((link) => link.label_id)),
  ];
  const labelsResult = labelIds.length
    ? await supabase
        .from("labels")
        .select("id, project_id, name, color")
        .in("id", labelIds)
    : { data: [], error: null };
  if (labelsResult.error) throw labelsResult.error;
  const people = new Map<string, TaskPerson>(
    (peopleResult.data ?? []).map((person) => [
      person.id,
      {
        id: person.id,
        email: person.email,
        fullName: person.full_name,
      },
    ])
  );
  const labels = new Map<string, ProjectTaskLabel>(
    (labelsResult.data ?? []).map((label) => [
      label.id,
      {
        id: label.id,
        projectId: label.project_id,
        name: label.name,
        color: label.color,
      },
    ])
  );
  const labelsByIssue = new Map<string, ProjectTaskLabel[]>();
  for (const link of linksResult.data ?? []) {
    const label = labels.get(link.label_id);
    if (label)
      labelsByIssue.set(link.issue_id, [
        ...(labelsByIssue.get(link.issue_id) ?? []),
        label,
      ]);
  }
  return rows.map((row) => ({
    id: row.id,
    issueNumber: Number(row.issue_number),
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignee: row.assignee_id ? (people.get(row.assignee_id) ?? null) : null,
    labels: labelsByIssue.get(row.id) ?? [],
  }));
}

async function getPeople(supabase: SupabaseClient, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map<string, TaskPerson>();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name")
    .in("id", ids);
  if (error) throw error;
  return new Map<string, TaskPerson>(
    (data ?? []).map((person) => [
      person.id,
      {
        id: person.id,
        email: person.email,
        fullName: person.full_name,
      },
    ])
  );
}
