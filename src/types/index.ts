// Core type definitions

export interface PRIdentifier {
  owner: string;
  repo: string;
  number: number;
}

/**
 * MCP-compliant cursor-based pagination
 * Reference: https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination
 */
export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;  // Opaque cursor, only present if more results exist
}

export type ErrorCategory = 
  | "user"
  | "api"
  | "logical"
  | "network"
  | "authentication"
  | "authorization"  // 403 permission errors (not rate limiting)
  | "rate_limit"
  | "timeout"
  | "unknown";

export interface ToolError {
  error: string;
  category: ErrorCategory;
  details?: Record<string, unknown>;
  suggestion?: string;
  retry_after?: number;
  documentation_url?: string;
}

export type Result<T, E = ToolError> = 
  | { success: true; data: T }
  | { success: false; error: E };

