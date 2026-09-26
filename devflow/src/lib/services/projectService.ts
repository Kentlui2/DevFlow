import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  ProjectMemberRole,
  UpdateProjectInput,
} from "@/lib/validation/project";

export async function createProject(supabase: SupabaseClient, input: CreateProjectInput) {
  const { data, error } = await supabase.rpc("create_project", {
    p_name: input.name,
    p_description: input.description ?? null,
  });
  if (error) throw error;
  return data;
}

export async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  input: UpdateProjectInput
) {
  const { data, error } = await supabase
    .from("projects")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id, name, description, owner_id, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(supabase: SupabaseClient, projectId: string) {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

export async function addProjectMember(
  supabase: SupabaseClient,
  projectId: string,
  input: AddProjectMemberInput
) {
  const { data, error } = await supabase.rpc("add_project_member_by_email", {
    p_project_id: projectId,
    p_email: input.email,
    p_role: input.role,
  });
  if (error) throw error;
  return data;
}

export async function updateProjectMemberRole(
  supabase: SupabaseClient,
  projectId: string,
  memberId: string,
  role: ProjectMemberRole
) {
  const { data, error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("id", memberId)
    .eq("project_id", projectId)
    .select("id, user_id, role, joined_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function removeProjectMember(
  supabase: SupabaseClient,
  projectId: string,
  memberId: string
) {
  const { data, error } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId)
    .eq("project_id", projectId)
    .neq("role", "owner")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}
