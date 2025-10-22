import { z } from 'zod';
import { PRIdentifierStringSchema } from '../../utils/validation.js';

export const FindUnresolvedCommentsSchema = z.object({
  pr: PRIdentifierStringSchema,
  include_bots: z.boolean().default(true),
  exclude_authors: z.array(z.string()).optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
  sort: z.enum(['chronological', 'by_file', 'by_author']).default('chronological')
});

export type FindUnresolvedCommentsInput = z.infer<typeof FindUnresolvedCommentsSchema>;

export interface Comment {
  id: number;
  type: 'review_comment' | 'issue_comment' | 'review';
  author: string;
  author_association: string;
  is_bot: boolean;
  created_at: string;
  updated_at: string;
  file_path?: string;
  line_number?: number;
  start_line?: number;
  diff_hunk?: string;
  body: string;
  body_html?: string;
  in_reply_to_id?: number;
  reactions?: {
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
  html_url: string;
  
  // Action commands for AI agent to execute
  action_commands: {
    reply_command: string;          // GitHub CLI command to reply (agent fills in text)
    resolve_command?: string;       // GitHub CLI command to resolve (ONLY after fix verified)
    resolve_condition: string;      // Warning: when this should be run
    view_in_browser: string;        // Open in browser for context
  };
  
  // Categorization hints to help agent prioritize
  hints: {
    has_security_keywords: boolean;
    has_blocking_keywords: boolean;
    is_question: boolean;
    severity_estimate: 'low' | 'medium' | 'high' | 'unknown';
  };
}

export interface FindUnresolvedCommentsOutput {
  pr: string;
  total_unresolved: number;
  comments: Comment[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  summary: {
    total_comments: number;
    by_author: Record<string, number>;
    by_type: Record<string, number>;
    bot_comments: number;
    human_comments: number;
    with_reactions: number;
  };
}

