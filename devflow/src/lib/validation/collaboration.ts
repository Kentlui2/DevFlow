import { z } from "zod";

export const issueStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export const issuePrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const issueFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  status: issueStatusSchema.default("open"),
  priority: issuePrioritySchema.default("medium"),
  assigneeId: z.string().uuid().optional().nullable(),
  labelIds: z.array(z.string().uuid()).max(20).optional(),
};

export const createIssueSchema = z.object(issueFields);
export const updateIssueSchema = z
  .object(issueFields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide issue details to update"
  );

export const issueFiltersSchema = z.object({
  status: issueStatusSchema.optional(),
  priority: issuePrioritySchema.optional(),
  assigneeId: z.union([z.string().uuid(), z.literal("unassigned")]).optional(),
  labelId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
});

export const commentTargetSchema = z.object({
  commentableType: z.enum(["task", "issue"]),
  commentableId: z.string().uuid(),
});
export const createCommentSchema = commentTargetSchema.extend({
  body: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});
export const updateCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type IssueFilters = z.infer<typeof issueFiltersSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
