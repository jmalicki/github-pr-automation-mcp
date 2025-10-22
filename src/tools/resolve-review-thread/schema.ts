import { z } from 'zod';

export const ResolveReviewThreadInputSchema = z.object({
  pr: z.string().min(1),
  thread_id: z.string().optional(),
  comment_id: z.string().optional(),
  prefer: z.enum(["thread", "comment"]).default("thread")
}).refine((v) => Boolean(v.thread_id) || Boolean(v.comment_id), {
  message: 'Either thread_id or comment_id must be provided'
});

export type ResolveReviewThreadInput = z.infer<typeof ResolveReviewThreadInputSchema>;

export const ResolveReviewThreadOutputSchema = z.object({
  ok: z.boolean(),
  thread_id: z.string(),
  alreadyResolved: z.boolean().default(false),
  message: z.string().optional()
});

export type ResolveReviewThreadOutput = z.infer<typeof ResolveReviewThreadOutputSchema>;


