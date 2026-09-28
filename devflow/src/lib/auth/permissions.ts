export type Role = "owner" | "developer" | "viewer";

/**
 * Single source of truth for what each project role can do — matches
 * the permission table in the PRD exactly. Every API route calls one
 * of these instead of duplicating role checks. RLS policies in
 * Supabase enforce the same rules independently, so a mistake here
 * doesn't become a real vulnerability.
 */
export const permissions = {
  viewProject: (_role: Role) => true,
  editProject: (role: Role) => role === "owner",
  deleteProject: (role: Role) => role === "owner",
  manageMembers: (role: Role) => role === "owner",
  createTask: (role: Role) => role !== "viewer",
  editTask: (role: Role) => role !== "viewer",
  deleteTask: (role: Role) => role !== "viewer",
  comment: (role: Role) => role !== "viewer",
  createIssue: (role: Role) => role !== "viewer",
  editIssue: (role: Role) => role !== "viewer",
  deleteIssue: (role: Role) => role !== "viewer",
  manageSprint: (role: Role) => role === "owner",
  viewAnalytics: (_role: Role) => true,
  viewActivity: (_role: Role) => true,
} as const satisfies Record<string, (role: Role) => boolean>;
