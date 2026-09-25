import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateTaskInput } from "@/lib/validation/task";

/**
 * Business logic lives here, not in the route handler. The route
 * handler's job is auth + validation + calling this; this function's
 * job is the actual database work. Keeping them separate means this
 * is unit-testable without spinning up a Next.js request.
 */
export async function createTask(
  supabase: SupabaseClient,
  projectId: string,
  createdBy: string,
  input: CreateTaskInput
) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      assignee_id: input.assigneeId ?? null,
      due_date: input.dueDate ?? null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
