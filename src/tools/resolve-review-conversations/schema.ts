import { z } from 'zod';

export const ResolveReviewConversationsInputSchema = z.object({
  pr: z.string().min(1),
  only_unresolved: z.boolean().default(true),
  dry_run: z.boolean().default(true),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type ResolveReviewConversationsInput = z.infer<typeof ResolveReviewConversationsInputSchema>;

export const ReviewThreadSchema = z.object({
  id: z.string(),
  is_resolved: z.boolean(),
  preview: z.string(),
  action_commands: z.object({
    resolve_command: z.string(),
    view_in_browser: z.string(),
  }),
});

export const ResolveReviewConversationsOutputSchema = z.object({
  pr: z.string(),
  threads: z.array(ReviewThreadSchema),
  nextCursor: z.string().optional(),
  summary: z.object({
    total: z.number().int().min(0),
    unresolved: z.number().int().min(0),
    suggested: z.number().int().min(0),
  }),
});

export type ResolveReviewConversationsOutput = z.infer<typeof ResolveReviewConversationsOutputSchema>;


