// Core type definitions

export interface PRIdentifier {
  owner: string;
  repo: string;
  number: number;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export type ErrorCategory = 
  | "user"
  | "api"
  | "logical"
  | "network"
  | "authentication"
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

