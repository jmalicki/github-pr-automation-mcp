import { z } from 'zod';
import { PRIdentifierStringSchema } from '../../utils/validation.js';

export const PermissionActionSchema = z.enum([
  'read_comments',
  'create_comments', 
  'resolve_threads',
  'merge_pr',
  'approve_pr',
  'request_changes',
  'read_ci',
  'write_ci'
]);

export const CheckPermissionsSchema = z.object({
  pr: PRIdentifierStringSchema,
  actions: z.array(PermissionActionSchema).optional(),
  detailed: z.boolean().default(false)
});

export type CheckPermissionsInput = z.infer<typeof CheckPermissionsSchema>;
export type PermissionAction = z.infer<typeof PermissionActionSchema>;

export interface ActionResult {
  allowed: boolean;
  reason?: string;
  required_scopes?: string[];
  error_details?: string;
}

export interface TokenInfo {
  valid: boolean;
  type: 'classic' | 'fine_grained' | 'unknown';
  user?: string;
  error?: string;
}

export interface RepositoryAccess {
  accessible: boolean;
  permissions: {
    admin: boolean;
    write: boolean;
    read: boolean;
  };
  error?: string;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset_time: string;
  status: 'healthy' | 'warning' | 'critical';
}

export interface CheckPermissionsOutput {
  // Basic token info
  token_valid: boolean;
  token_type: 'classic' | 'fine_grained' | 'unknown';
  user?: string;
  
  // Repository access
  repository_access: boolean;
  repository_permissions: {
    admin: boolean;
    write: boolean;
    read: boolean;
  };
  
  // Action-specific results
  action_results: Record<PermissionAction, ActionResult>;
  
  // Diagnostic information
  diagnostics: {
    missing_scopes: string[];
    suggestions: string[];
    rate_limit_status: 'healthy' | 'warning' | 'critical';
    rate_limit_details: RateLimitInfo;
  };
  
  // Fix recommendations
  fixes: {
    immediate: string[];
    token_update: string[];
    alternative_commands: Record<PermissionAction, string>;
  };
  
  // Summary
  summary: {
    overall_status: 'healthy' | 'warning' | 'critical';
    working_actions: PermissionAction[];
    failing_actions: PermissionAction[];
    primary_issue?: string;
  };
}
