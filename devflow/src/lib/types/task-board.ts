import type { TaskPriority, TaskStatus } from "@/lib/types";

export type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

export type TaskPerson = {
  id: string;
  email: string;
  fullName: string | null;
};

export type TaskBoardItem = {
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
  assignee: TaskPerson | null;
  labels: TaskLabel[];
};

export type ProjectTaskLabel = TaskLabel & { projectId: string };

export type TaskStatusOption = { value: TaskStatus; label: string };

export const TASK_STATUSES: TaskStatusOption[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "done", label: "Done" },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
