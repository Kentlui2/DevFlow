import { z } from "zod";

const sprintFields = {
  name: z.string().trim().min(1, "Sprint name is required").max(100),
  startDate: z.string().date(),
  endDate: z.string().date(),
};

export const createSprintSchema = z
  .object(sprintFields)
  .refine((value) => value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "End date must be on or after the start date",
  });

export const updateSprintSchema = z
  .object({
    name: sprintFields.name.optional(),
    startDate: sprintFields.startDate.optional(),
    endDate: sprintFields.endDate.optional(),
    status: z.enum(["active", "completed"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one sprint field to update",
  })
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.endDate >= value.startDate,
    {
      path: ["endDate"],
      message: "End date must be on or after the start date",
    }
  );

export const addSprintTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(100),
});

export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
