import { z } from 'zod';
import { PRIdentifierStringSchema } from '../../utils/validation.js';

export const FindUnresolvedCommentsSchema = z.object({
  pr: PRIdentifierStringSchema,
  include_bots: z.boolean().default(true),
  exclude_authors: z.array(z.string()).optional(),
  cursor: z.string().optional(), // MCP cursor-based pagination
  sort: z.enum(['chronological', 'by_file', 'by_author', 'priority']).default('priority'),
  parse_review_bodies: z.boolean().default(true), // Parse review bodies for actionable comments
  include_status_indicators: z.boolean().default(true), // 💾 User preference: Include status indicators
  priority_ordering: z.boolean().default(true), // 💾 User preference: Use priority-based ordering
  coderabbit_options: z.object({
    include_nits: z.boolean().optional().default(true), // 💾 User preference: Include minor suggestions
    include_duplicates: z.boolean().optional().default(true), // 💾 User preference: Include duplicate suggestions
    include_additional: z.boolean().optional().default(true), // 💾 User preference: Include additional comments
    suggestion_types: z.array(z.enum(['nit', 'duplicate', 'additional', 'actionable'])).optional(),
    prioritize_actionable: z.boolean().optional().default(false), // 💾 User preference: Show actionable items first
    group_by_type: z.boolean().optional().default(false), // 💾 User preference: Group comments by suggestion type
    extract_agent_prompts: z.boolean().optional().default(true) // 💾 User preference: Generate agent-friendly prompts
  }).optional()
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
  outdated?: boolean; // GitHub API field indicating if comment is on outdated code
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
  
  // Status indicators for better workflow management
  status_indicators?: {
    needs_mcp_resolution: boolean; // Has mcp_action that can be resolved via MCP
    has_manual_response: boolean; // Has replies from humans
    is_actionable: boolean; // Contains actionable suggestions
    is_outdated: boolean; // Comment is likely outdated (old, on changed code, etc.)
    priority_score: number; // Calculated priority (0-100, higher = more important)
    resolution_status: 'unresolved' | 'acknowledged' | 'in_progress' | 'resolved';
    suggested_action: 'reply' | 'resolve' | 'investigate' | 'ignore';
  };
  
  // Action commands for AI agent to execute
  action_commands: {
    reply_command: string;          // GitHub CLI command to reply (agent fills in text)
    resolve_command?: string;       // GitHub CLI command to resolve (ONLY after fix verified)
    resolve_condition: string;      // Warning: when this should be run
    view_in_browser: string;        // Open in browser for context
    mcp_action?: {                  // MCP action for review thread resolution (if applicable)
      tool: 'resolve_review_thread';
      args: {
        pr: string;
        thread_id: string;
      };
    };
  };
  
  // CodeRabbit-specific metadata (only present for CodeRabbit comments)
  coderabbit_metadata?: {
    suggestion_type: 'nit' | 'duplicate' | 'additional' | 'actionable';
    severity: 'low' | 'medium' | 'high';
    category: string; // e.g., "style", "performance", "security"
    file_context: {
      path: string;
      line_start?: number;
      line_end?: number;
    };
    code_suggestion?: {
      old_code?: string;
      new_code?: string;
      language?: string;
    };
    agent_prompt?: string; // Structured prompt for AI agents
    implementation_guidance?: {
      priority: 'low' | 'medium' | 'high';
      effort_estimate: string; // e.g., "2-3 minutes", "quick fix"
      dependencies?: string[]; // Other suggestions that should be addressed first
      rationale: string; // Why this change is suggested
    };
  };
}

export interface FindUnresolvedCommentsOutput {
  pr: string;
  unresolved_in_page: number;
  comments: Comment[];
  nextCursor?: string; // MCP cursor-based pagination
  summary: {
    comments_in_page: number;
    by_author: Record<string, number>;
    by_type: Record<string, number>;
    bot_comments: number;
    human_comments: number;
    with_reactions: number;
    // Priority-based summary when status indicators are enabled
    priority_summary?: {
      high_priority: number; // Priority score >= 70
      medium_priority: number; // Priority score 30-69
      low_priority: number; // Priority score < 30
      needs_mcp_resolution: number; // Comments that can be resolved via MCP
      has_manual_responses: number; // Comments with human replies
      actionable_items: number; // Comments with actionable suggestions
      outdated_comments: number; // Comments that are likely outdated
    };
    // Status-based grouping when priority ordering is enabled
    status_groups?: {
      unresolved: Comment[]; // No responses, needs attention
      acknowledged: Comment[]; // Has responses but not resolved
      in_progress: Comment[]; // Being worked on
      resolved: Comment[]; // Should be filtered out but included for completeness
    };
  };
}

