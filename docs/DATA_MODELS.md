# Data Models and Type Definitions

## Core Types

### PR Identifier

```typescript
interface PRIdentifier {
  owner: string;        // Repository owner
  repo: string;         // Repository name
  number: number;       // PR number
}

// Parser supports multiple formats:
// - "owner/repo#123"
// - "owner/repo/pulls/123"
// - "https://github.com/owner/repo/pull/123"
function parsePRIdentifier(input: string): PRIdentifier;
```

### Pagination Metadata

```typescript
interface PaginationMeta {
  page: number;          // Current page (1-indexed)
  page_size: number;     // Items per page
  total_items: number;   // Total items across all pages
  total_pages: number;   // Total number of pages
  has_next: boolean;     // Has next page
  has_previous: boolean; // Has previous page
}

interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}
```

---

## Tool-Specific Models

### get_failing_tests Models

```typescript
interface FailedTest {
  // Identity
  check_name: string;      // e.g., "pytest / unit-tests"
  test_name: string;       // e.g., "test_authentication.py::test_login"
  
  // Error details
  error_message: string;   // Extracted error message
  error_type?: string;     // e.g., "AssertionError", "TimeoutError"
  stack_trace?: string;    // Full stack trace if available
  
  // Location
  file_path?: string;      // Source file path
  line_number?: number;    // Line number where failure occurred
  
  // Metadata
  log_url: string;         // URL to full CI logs
  confidence: "high" | "medium" | "low"; // Parse confidence
  
  // Context
  test_category?: string;  // e.g., "unit", "integration", "e2e"
  flakiness_score?: number; // If historical data available (0-1)
}

interface CIInfo {
  workflow_name: string;
  run_id: number;
  run_url: string;
  started_at: string;      // ISO 8601 timestamp
  completed_at?: string;   // ISO 8601 timestamp
  duration_seconds?: number;
  status: "pending" | "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "cancelled" | "skipped" | "timed_out";
}

interface TestInstructions {
  summary: string;         // "3 authentication tests failed"
  priority: PrioritizedFailure[];
  commands: string[];      // Commands to reproduce locally
  estimated_fix_time?: string;
}

interface PrioritizedFailure {
  test: string;
  priority: number;        // 1 = highest
  reason: string;          // Why this is prioritized
  suggested_fix?: string;  // AI-generated fix suggestion
  related_failures?: string[]; // Other tests that might be affected
}

interface PollInfo {
  message: string;         // "CI still running, estimated 5 minutes remaining"
  estimated_completion?: string; // ISO 8601 timestamp
  retry_after_seconds: number;
  current_step?: string;   // e.g., "Running unit tests (step 3/5)"
}
```

### find_unresolved_comments Models

```typescript
interface Comment {
  // Identity
  id: number;
  type: "review_comment" | "issue_comment" | "review";
  
  // Author
  author: string;
  author_association: "OWNER" | "MEMBER" | "CONTRIBUTOR" | "COLLABORATOR" | "NONE";
  is_bot: boolean;
  
  // Timing
  created_at: string;      // ISO 8601
  updated_at: string;      // ISO 8601
  
  // Location (for review comments)
  file_path?: string;
  line_number?: number;
  start_line?: number;     // For multi-line comments
  diff_hunk?: string;      // Code context
  commit_id?: string;      // Specific commit
  
  // Content
  body: string;            // Markdown content
  body_html?: string;      // Rendered HTML if needed
  
  // Thread information
  in_reply_to_id?: number; // If part of a conversation
  
  // Reactions (helps LLM assess resolution status)
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
  
  // Metadata
  html_url: string;        // Web URL to comment
}

// Note: The following are determined by the LLM, not the tool
type CommentCategory = 
  | "blocking"      // Must be addressed before merge
  | "nit"          // Style/minor issues
  | "question"     // Needs clarification
  | "suggestion"   // Improvement idea
  | "praise"       // Positive feedback
  | "other";       // Uncategorized

interface CommentSummary {
  total_comments: number;
  by_author: Record<string, number>;
  by_type: Record<string, number>;
  bot_comments: number;
  human_comments: number;
  with_reactions: number;
}
```

### manage_stacked_prs Models

```typescript
interface StackValidation {
  is_stacked: boolean;
  valid: boolean;          // True if properly configured
  issues: string[];        // Problems detected
}

interface StackInfo {
  base_branch: string;     // Base PR's head branch
  dependent_base: string;  // Dependent PR's base branch
  matches: boolean;        // They align correctly
  visualization: string;   // ASCII art representation
  
  // Branch information
  base_pr_head: string;    // SHA of base PR's head
  dependent_pr_head: string; // SHA of dependent PR's head
  common_ancestor?: string; // Merge base SHA
}

interface ChangeSummary {
  new_commits_in_base: number;
  new_commits_in_dependent: number;
  
  commits: CommitInfo[];
  
  files_changed_in_base: string[];
  files_changed_in_dependent: string[];
  overlapping_files: string[];      // Files changed in both
  potential_conflicts: string[];    // Files likely to conflict
  
  // Stats
  base_additions: number;
  base_deletions: number;
  dependent_additions: number;
  dependent_deletions: number;
}

interface CommitInfo {
  sha: string;
  short_sha: string;       // First 7 characters
  message: string;         // Commit message
  author: string;
  author_email: string;
  date: string;            // ISO 8601
  files_changed: string[];
}

interface Command {
  step: number;
  type: "git" | "ci_wait" | "test" | "fix" | "verification" | "github_api";
  command: string;         // Executable command
  description: string;     // Human-readable explanation
  
  // Execution metadata
  estimated_duration?: string;
  can_automate: boolean;
  is_idempotent: boolean;  // Safe to retry
  
  // Conditional execution
  skip_if?: string;        // Condition to skip (human-readable)
  run_only_if?: string;    // Condition to run
  retry_on_failure?: boolean;
  max_retries?: number;
  
  // Dependencies
  depends_on?: number[];   // Step numbers that must complete first
  
  // Output handling
  expect_output?: string;  // What to look for in output
  on_success?: string;     // What to do if successful
  on_failure?: string;     // What to do if failed
}

interface AutomationStatus {
  enabled: boolean;
  current_step?: number;
  status: "not_started" | "in_progress" | "paused" | "completed" | "failed";
  
  // Progress tracking
  steps_completed: number;
  steps_total: number;
  steps_failed: number;
  
  // Error info
  error?: string;
  failed_step?: number;
  can_retry: boolean;
  
  // Timing
  started_at?: string;     // ISO 8601
  completed_at?: string;   // ISO 8601
  elapsed_seconds?: number;
}

interface StackSummary {
  action_required: boolean;
  reason: string;          // Why action is or isn't needed
  
  // Risk assessment
  risk_level: "low" | "medium" | "high";
  risk_factors: string[];  // Reasons for risk level
  
  // Estimates
  estimated_total_time: string;
  estimated_manual_steps: number;
  estimated_automated_steps: number;
  
  // Recommendations
  recommendations: string[];
}
```

### detect_merge_conflicts Models

```typescript
interface MergeConflict {
  file_path: string;
  conflict_type: "content" | "rename" | "delete" | "mode" | "submodule";
  
  // Conflict details
  base_content_preview?: string;   // First 10 lines from base
  head_content_preview?: string;   // First 10 lines from head
  conflict_markers?: string;       // The actual <<<< ==== >>>> section
  
  // Location in file
  start_line?: number;
  end_line?: number;
  
  // Resolution
  suggested_resolution?: string;
  resolution_confidence: "high" | "medium" | "low";
  can_auto_resolve: boolean;
}

type MergeableState = 
  | "clean"        // No conflicts, ready to merge
  | "unstable"     // Mergeable but CI pending
  | "dirty"        // Has conflicts
  | "unknown"      // GitHub hasn't computed yet
  | "blocked";     // Blocked by protection rules
```

### check_merge_readiness Models

```typescript
interface MergeReadinessCheck {
  ready_to_merge: boolean;
  
  checks: {
    ci_passing: boolean;
    approvals_met: boolean;
    no_conflicts: boolean;
    up_to_date: boolean;
    branch_protection_satisfied: boolean;
    required_checks_passed: boolean;
    no_requested_changes: boolean;
  };
  
  blocking_issues: BlockingIssue[];
  warnings: Warning[];
}

interface BlockingIssue {
  category: "ci" | "approvals" | "conflicts" | "protection" | "reviews";
  severity: "critical" | "error";
  description: string;
  action_required: string;  // What to do to fix
  estimated_time?: string;
}

interface Warning {
  category: string;
  description: string;
  can_ignore: boolean;
  recommendation: string;
}

interface BranchProtection {
  enabled: boolean;
  
  required_approvals: number;
  current_approvals: number;
  approving_users: string[];
  
  required_checks: string[];
  passing_checks: string[];
  failing_checks: string[];
  pending_checks: string[];
  
  dismiss_stale_reviews: boolean;
  require_code_owner_reviews: boolean;
  code_owners_satisfied: boolean;
  
  allow_force_pushes: boolean;
  allow_deletions: boolean;
  required_linear_history: boolean;
  
  restrictions?: {
    users: string[];
    teams: string[];
  };
}
```

### analyze_pr_impact Models

```typescript
interface PRImpact {
  pr: PRIdentifier;
  
  changes: {
    files_changed: number;
    additions: number;
    deletions: number;
    commits: number;
  };
  
  impact_areas: ImpactArea[];
  
  // File categorization
  files_by_type: Record<string, string[]>;
  files_by_directory: Record<string, string[]>;
  
  // Risk assessment
  overall_risk: "low" | "medium" | "high" | "critical";
  risk_factors: RiskFactor[];
  
  // Reviewer suggestions
  suggested_reviewers?: Reviewer[];
  required_reviewers?: string[];  // Based on CODEOWNERS
  
  // Similar PRs
  similar_prs?: SimilarPR[];
  
  // Dependencies
  breaking_changes_detected: boolean;
  dependency_updates: DependencyUpdate[];
}

interface ImpactArea {
  category: "frontend" | "backend" | "database" | "infrastructure" | 
            "tests" | "docs" | "config" | "dependencies" | "other";
  files: string[];
  lines_changed: number;
  risk_level: "low" | "medium" | "high";
  description: string;
  requires_specialist?: string; // e.g., "database-team"
}

interface RiskFactor {
  factor: string;          // e.g., "Large changeset"
  severity: "low" | "medium" | "high";
  description: string;
  mitigation?: string;
}

interface Reviewer {
  username: string;
  relevance_score: number; // 0-100
  reason: string;          // Why suggested
  expertise_areas: string[];
  
  // Historical data
  previous_reviews: number;
  files_owned: number;     // How many changed files they've touched
  avg_review_time?: string;
}

interface SimilarPR {
  number: number;
  title: string;
  similarity_score: number; // 0-100
  similarity_reasons: string[];
  outcome: "merged" | "closed";
  merge_time?: string;     // How long it took
  review_comments: number;
}

interface DependencyUpdate {
  type: "npm" | "pip" | "cargo" | "go" | "maven" | "other";
  package: string;
  from_version: string;
  to_version: string;
  is_breaking: boolean;
  changelog_url?: string;
}
```

### get_review_suggestions Models

```typescript
interface ReviewContext {
  pr: PRIdentifier;
  
  metadata: {
    title: string;
    description: string;
    author: string;
    labels: string[];
    milestone?: string;
    draft: boolean;
  };
  
  files: ReviewFile[];
  
  review_checklist: ReviewChecklist[];
  
  context: {
    related_issues: number[];
    mentioned_prs: number[];
    breaking_changes_detected: boolean;
    security_sensitive_files: string[];
    performance_impact_files: string[];
  };
  
  // AI optimization
  token_estimate: number;   // Estimated tokens for AI processing
  complexity_score: number; // 1-10, how complex is this PR
}

interface ReviewFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  
  // Stats
  additions: number;
  deletions: number;
  changes: number;         // additions + deletions
  
  // Content
  diff_excerpt?: string;   // Truncated diff (first N lines)
  full_diff_available: boolean;
  language?: string;       // Programming language
  
  // Focus points
  focus_points: FocusPoint[];
  
  // Categorization
  category: "production" | "test" | "config" | "docs" | "build";
  risk_level: "low" | "medium" | "high";
}

interface FocusPoint {
  type: "security" | "performance" | "logic" | "style" | "testing" | "docs";
  line_range?: [number, number];
  description: string;
  severity: "info" | "warning" | "critical";
  suggestion?: string;
}

interface ReviewChecklist {
  category: string;        // e.g., "Security", "Performance"
  items: ChecklistItem[];
}

interface ChecklistItem {
  question: string;        // "Are user inputs properly validated?"
  guidance: string;        // How to evaluate
  priority: "required" | "recommended" | "optional";
  applicable: boolean;     // Is this relevant to this PR?
  auto_checkable: boolean; // Can be checked automatically?
  auto_result?: "pass" | "fail" | "warning";
}
```

---

## GitHub API Response Types

### Simplified Types (not exhaustive)

```typescript
// GitHub Check Run
interface GitHubCheckRun {
  id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "neutral" | "cancelled" | "skipped" | 
              "timed_out" | "action_required" | null;
  started_at: string;
  completed_at: string | null;
  output: {
    title: string;
    summary: string;
    text: string;
  };
  html_url: string;
}

// GitHub Pull Request
interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  draft: boolean;
  user: GitHubUser;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  mergeable: boolean | null;
  mergeable_state: string;
  merged: boolean;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

// GitHub Review Comment
interface GitHubReviewComment {
  id: number;
  user: GitHubUser;
  body: string;
  path: string;
  position: number | null;
  line: number;
  commit_id: string;
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
}

interface GitHubUser {
  login: string;
  id: number;
  type: "User" | "Bot";
}
```

---

## Error Models

```typescript
interface ToolError {
  error: string;           // Human-readable message
  category: ErrorCategory;
  details?: Record<string, any>;
  suggestion?: string;     // How to fix
  retry_after?: number;    // Seconds to wait before retry
  documentation_url?: string;
}

type ErrorCategory = 
  | "user"         // Invalid input
  | "api"          // GitHub API error
  | "logical"      // Business logic error
  | "network"      // Connection issues
  | "authentication" // Token/permission issues
  | "rate_limit"   // API rate limiting
  | "timeout"      // Operation timed out
  | "unknown";     // Unexpected error

interface APIError {
  status: number;          // HTTP status code
  message: string;
  documentation_url?: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
  }>;
}
```

---

## Utility Types

```typescript
// Result type for error handling
type Result<T, E = ToolError> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Async polling configuration
interface PollConfig {
  interval_ms: number;     // Time between polls
  timeout_ms: number;      // Max time to wait
  max_attempts?: number;   // Max number of polls
  backoff_multiplier?: number; // Exponential backoff
}

// Command execution result
interface CommandResult {
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
}
```

This data model specification provides a complete type system for the MCP server implementation.

