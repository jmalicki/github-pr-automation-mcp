import { z } from 'zod';
import { PRIdentifierStringSchema } from '../../utils/validation.js';

export const ManageStackedPRsSchema = z.object({
  base_pr: PRIdentifierStringSchema,
  dependent_pr: PRIdentifierStringSchema,
  auto_fix: z.boolean().default(true),
  use_onto: z.boolean().optional(),
  onto_base: z.string().optional(),
  max_iterations: z.number().int().min(1).default(3),
  cursor: z.string().optional() // MCP cursor-based pagination
});

export type ManageStackedPRsInput = z.infer<typeof ManageStackedPRsSchema>;

export interface Command {
  step: number;
  type: 'git' | 'ci_wait' | 'test' | 'fix' | 'verification';
  command: string;
  description: string;
  estimated_duration?: string;
  can_automate: boolean;
}

export interface ManageStackedPRsOutput {
  base_pr: string;
  dependent_pr: string;
  is_stacked: boolean;
  stack_info: {
    base_branch: string;
    dependent_base: string;
    matches: boolean;
    visualization: string;
  };
  changes_detected: boolean;
  change_summary?: {
    new_commits_in_base: number;
    commits: Array<{
      sha: string;
      message: string;
      author: string;
    }>;
    files_changed: string[];
  };
  rebase_strategy?: {
    recommended: 'regular' | 'onto';
    reason: string;
    regular_command?: string;
    onto_command?: string;
    ai_should_decide: boolean;
    considerations: string[];
  };
  commands: Command[];
  nextCursor?: string; // MCP cursor-based pagination
  summary: {
    action_required: boolean;
    reason: string;
    estimated_total_time: string;
    risk_level: 'low' | 'medium' | 'high';
  };
}

