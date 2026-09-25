import { z } from "zod";

export const taskStatusEnum = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
]);

export const taskPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  status: taskStatusEnum.default("backlog"),
  priority: taskPriorityEnum.default("medium"),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().date().optional(),
  labelIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
