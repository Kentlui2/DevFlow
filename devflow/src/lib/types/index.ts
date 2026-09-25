export type Role = "owner" | "developer" | "viewer";
export type TaskStatus =
  "backlog" | "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type IssueStatus = "open" | "in_progress" | "resolved" | "closed";
export type SprintStatus = "planned" | "active" | "completed";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: Role;
  joinedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  createdBy: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// Issue, Sprint, Comment, Activity, Label types follow the same shape
// as the DB design in docs/database.md — add them here as each phase
// that needs them is implemented, rather than speculatively now.
