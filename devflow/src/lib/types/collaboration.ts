import type { ProjectTaskLabel, TaskPerson } from "@/lib/types/task-board";

export type IssueStatus = "open" | "in_progress" | "resolved" | "closed";
export type IssuePriority = "low" | "medium" | "high" | "urgent";

export type ProjectIssue = {
  id: string;
  issueNumber: number;
  projectId: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignee: TaskPerson | null;
  labels: ProjectTaskLabel[];
};

export type ProjectComment = {
  id: string;
  projectId: string;
  authorId: string;
  author: TaskPerson;
  commentableType: "task" | "issue";
  commentableId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectActivity = {
  id: string;
  projectId: string;
  actorId: string;
  actor: TaskPerson;
  actionType: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export const ISSUE_STATUSES: { value: IssueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export const ISSUE_PRIORITIES: { value: IssuePriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
