import { z } from "zod";
import { PRIdentifierStringSchema } from "../../utils/validation.js";

/**
 * FindUnresolvedCommentsSchema - Zod schema for find_unresolved_comments tool
 *
 * IMPORTANT: This schema uses zodToJsonSchema() from @alcyone-labs/zod-to-json-schema
 * instead of Zod v4's built-in z.toJSONSchema() due to a critical bug.
 *
 * ## The Zod v4 JSON Schema Bug
 *
 * Zod v4's built-in z.toJSONSchema() has a bug where it incorrectly marks fields
 * with default values as "required" in the generated JSON Schema, even when they
 * are explicitly marked as optional using .optional().
 *
 * Example of the bug:
 * ```typescript
 * const schema = z.object({
 *   required: z.string(),
 *   optional_default: z.string().optional().default('test'),
 * });
 *
 * const jsonSchema = z.toJSONSchema(schema);
 * // BUG: jsonSchema.required = ['required', 'optional_default']
 * // Expected: jsonSchema.required = ['required']
 * ```
 *
 * ## The Solution
 *
 * We use @alcyone-labs/zod-to-json-schema, which is a fork of the original
 * zod-to-json-schema library that supports Zod v4 and correctly handles
 * optional fields with defaults.
 *
 * This library correctly generates:
 * ```typescript
 * const jsonSchema = zodToJsonSchema(schema);
 * // CORRECT: jsonSchema.required = ['required']
 * // optional_default is NOT in required array, but has default: 'test'
 * ```
 *
 * ## Why This Matters for MCP
 *
 * Optional parameters are fundamental to MCP (Model Context Protocol). MCP clients
 * expect optional fields to NOT be in the JSON Schema's "required" array, even
 * if they have default values. This allows clients to omit optional parameters
 * and let the server apply defaults.
 *
 * Most MCP servers work correctly because they use:
 * - Zod v3 (which doesn't have this bug)
 * - zod-to-json-schema library (which handles optional fields correctly)
 *
 * The official MCP SDK (@modelcontextprotocol/sdk) uses:
 * - zod@3.23.8
 * - zod-to-json-schema@3.24.1
 *
 * ## Schema Design Notes
 *
 * - All fields except 'pr' are optional with defaults
 * - Descriptions include emoji annotations (💾) and user preference hints
 * - coderabbit_options is a nested optional object with its own defaults
 * - The schema matches the manual MCP schema in src/index.ts exactly
 *
 * @see {@link https://github.com/alcyone-labs/zod-to-json-schema} - Zod v4 compatible JSON Schema generator
 * @see {@link https://github.com/colinhacks/zod/issues/1643} - Zod issue about optional fields
 * @see {@link https://github.com/colinhacks/zod/issues/4179} - Zod issue about default values
 */
export const FindUnresolvedCommentsSchema = z.object({
  pr: PRIdentifierStringSchema.describe(
    "PR identifier (owner/repo#123 or URL)",
  ),
  include_bots: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "💾 Include bot comments (default: true). User preference: noise tolerance",
    ),
  exclude_authors: z
    .array(z.string())
    .optional()
    .describe("Specific authors to exclude (optional)"),
  cursor: z
    .string()
    .optional()
    .describe("MCP cursor for pagination (optional)"),
  sort: z
    .enum(["chronological", "by_file", "by_author", "priority"])
    .optional()
    .default("priority")
    .describe(
      "💾 Sort order: chronological, by_file, by_author, priority (default: priority). User preference",
    ),
  parse_review_bodies: z
    .boolean()
    .optional()
    .default(true)
    .describe("Parse review bodies for actionable comments (default: true)"),
  include_status_indicators: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "💾 Include status indicators (default: true). User preference: workflow management",
    ),
  priority_ordering: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "💾 Use priority-based ordering (default: true). User preference: task prioritization",
    ),
  coderabbit_options: z
    .object({
      include_nits: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "💾 Include minor suggestions (default: true). User preference: noise tolerance",
        ),
      include_duplicates: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "💾 Include duplicate suggestions (default: true). User preference: code quality focus",
        ),
      include_additional: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "💾 Include additional comments (default: true). User preference: enhancement suggestions",
        ),
      suggestion_types: z
        .array(z.enum(["nit", "duplicate", "additional", "actionable"]))
        .optional()
        .describe("Specific suggestion types to include (optional)"),
      prioritize_actionable: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "💾 Show actionable items first (default: false). User preference: priority focus",
        ),
      group_by_type: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "💾 Group comments by suggestion type (default: false). User preference: organization",
        ),
      extract_agent_prompts: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "💾 Generate agent-friendly prompts (default: true). User preference: AI agent optimization",
        ),
    })
    .optional()
    .describe("CodeRabbit-specific parsing and filtering options"),
});

export type FindUnresolvedCommentsInput = z.infer<
  typeof FindUnresolvedCommentsSchema
>;

export interface Comment {
  id: number;
  type: "review_comment" | "issue_comment" | "review";
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
    "+1": number;
    "-1": number;
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
    resolution_status:
      | "unresolved"
      | "acknowledged"
      | "in_progress"
      | "resolved";
    suggested_action: "reply" | "resolve" | "investigate" | "ignore";
  };

  // Action commands for AI agent to execute
  action_commands: {
    reply_command: string; // GitHub CLI command to reply (agent fills in text)
    resolve_command?: string; // GitHub CLI command to resolve (ONLY after fix verified)
    resolve_condition: string; // Warning: when this should be run
    view_in_browser: string; // Open in browser for context
    mcp_action?: {
      // MCP action for review thread resolution (if applicable)
      tool: "resolve_review_thread";
      args: {
        pr: string;
        thread_id: string;
      };
    };
  };

  // CodeRabbit-specific metadata (only present for CodeRabbit comments)
  coderabbit_metadata?: {
    suggestion_type: "nit" | "duplicate" | "additional" | "actionable";
    severity: "low" | "medium" | "high";
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
      priority: "low" | "medium" | "high";
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
