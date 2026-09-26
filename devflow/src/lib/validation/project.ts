import { z } from "zod";

const projectFields = {
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(80),
  description: z.string().trim().max(500).optional().nullable(),
};

export const createProjectSchema = z.object(projectFields);
export const updateProjectSchema = z
  .object(projectFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one project field to update");

export const projectMemberRoleSchema = z.enum(["developer", "viewer"]);

export const addProjectMemberSchema = z.object({
  email: z.string().trim().email().max(254),
  role: projectMemberRoleSchema,
});

export const updateProjectMemberSchema = z.object({
  role: projectMemberRoleSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type ProjectMemberRole = z.infer<typeof projectMemberRoleSchema>;
