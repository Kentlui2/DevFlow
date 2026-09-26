import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/auth/permissions";

const roles: Role[] = ["owner", "developer", "viewer"];

export async function getProjectRole(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<Role | null> {
  const { data } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  return data && roles.includes(data.role as Role) ? (data.role as Role) : null;
}
