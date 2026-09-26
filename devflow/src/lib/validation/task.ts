import { z } from "zod";

export const taskStatusEnum = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
]);

export const taskPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

const taskFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  status: taskStatusEnum.default("backlog"),
  priority: taskPriorityEnum.default("medium"),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().date().optional().nullable(),
  labelIds: z.array(z.string().uuid()).max(20).optional(),
};

export const createTaskSchema = z.object(taskFields);

export const updateTaskSchema = z
  .object(taskFields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one task field to update"
  );

export const taskFiltersSchema = z.object({
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.union([z.string().uuid(), z.literal("unassigned")]).optional(),
  labelId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
});

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(32),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#315B5A"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskStatusValue = z.infer<typeof taskStatusEnum>;
export type TaskPriorityValue = z.infer<typeof taskPriorityEnum>;
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
