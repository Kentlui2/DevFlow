import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "@/lib/services/projectService";
import { createProjectSchema } from "@/lib/validation/project";
import { apiError, readJson } from "@/lib/http/api-response";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const { data: memberships, error: membershipError } = await supabase
    .from("project_members")
    .select("project_id, role, joined_at")
    .eq("user_id", user.id);
  if (membershipError) return apiError("Could not load projects", "INTERNAL_ERROR", 500);

  const membershipRows = memberships ?? [];
  const projectIds = membershipRows.map((membership) => membership.project_id);
  if (!projectIds.length) return NextResponse.json({ data: [] });

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, description, owner_id, created_at, updated_at")
    .in("id", projectIds)
    .order("updated_at", { ascending: false });
  if (error) return apiError("Could not load projects", "INTERNAL_ERROR", 500);

  const membershipByProject = new Map(membershipRows.map((item) => [item.project_id, item]));
  return NextResponse.json({
    data: projects.map((project) => ({ ...project, membership: membershipByProject.get(project.id) })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);

  const parsed = createProjectSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("Invalid project details", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const project = await createProject(supabase, parsed.data);
    return NextResponse.json({ data: project }, { status: 201 });
  } catch {
    return apiError("Could not create the project", "INTERNAL_ERROR", 500);
  }
}
