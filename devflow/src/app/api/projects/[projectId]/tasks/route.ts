import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTaskSchema } from "@/lib/validation/task";
import { permissions } from "@/lib/auth/permissions";
import { createTask } from "@/lib/services/taskService";

/**
 * Reference implementation for every mutating route in DevFlow:
 * authenticate -> validate -> authorize -> call service -> respond.
 * Phase 5 (Task Management) fills in GET (list + filters) and the
 * sibling /api/tasks/[taskId] routes following this same shape.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();

  // 1. Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { message: "Not authenticated", code: "UNAUTHENTICATED" } },
      { status: 401 }
    );
  }

  // 2. Validate
  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "Invalid input",
          code: "VALIDATION_ERROR",
          issues: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  // 3. Authorize — look up the caller's role on this project
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!membership || !permissions.createTask(membership.role)) {
    return NextResponse.json(
      { error: { message: "Not authorized", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  // 4. Call the service layer
  try {
    const task = await createTask(supabase, projectId, user.id, parsed.data);
    return NextResponse.json({ data: task }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { message: "Failed to create task", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
