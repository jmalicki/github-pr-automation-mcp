# API Design Specification

> **Philosophy**: See [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) - We're a dumb tool, the agent is smart.
> We fetch data and provide commands. The agent interprets and decides.

## Tool Catalog

<!-- MCP_TOOLS_START -->
<!-- This section is used by tests to verify MCP server sync -->

### 1. get_failing_tests

**Purpose**: Extract failing test information from PR CI checks and provide targeted fix instructions.

**Use Cases**:
- AI wants to know what's broken before starting fixes
- Quick feedback loop: Get first failure ASAP
- Complete analysis: Get all failures for batch fixing

**Input Schema**:
```typescript
interface GetFailingTestsInput {
  pr: string;              // Format: "owner/repo#number" or "owner/repo/pulls/number"
  wait?: boolean;          // Wait for CI completion (default: false) 💾
  bail_on_first?: boolean; // Stop at first failure when waiting (default: true) 💾
  cursor?: string;         // MCP cursor for pagination
}
```

**Output Schema**:
```typescript
interface GetFailingTestsOutput {
  pr: string;              // Normalized PR identifier
  status: "pending" | "running" | "failed" | "passed" | "unknown";
  
  // CI run metadata
  ci_info?: {
    workflow_name: string;
    run_id: number;
    started_at: string;
    completed_at?: string;
    duration_seconds?: number;
  };
  
  // Paginated failures
  failures: Array<{
    check_name: string;      // e.g., "pytest / unit-tests"
    test_name: string;       // e.g., "test_authentication.py::test_login"
    error_message: string;   // Extracted error
    log_url: string;         // Link to full logs
    file_path?: string;      // Source file if detectable
    line_number?: number;    // Line number if detectable
    confidence: "high" | "medium" | "low"; // Parse confidence
  }>;
  
  // MCP cursor-based pagination
  nextCursor?: string;  // Opaque cursor, only present if more results exist
  
  // AI-ready instructions
  instructions: {
    summary: string;         // "3 tests failed in authentication module"
    priority: Array<{
      test: string;
      reason: string;        // "This failure is blocking 5 other tests"
      suggested_fix?: string;
    }>;
    commands: string[];      // Shell commands to reproduce locally
  };
  
  // If wait=true and still running
  poll_info?: {
    message: string;         // "CI still running, check back in 30s"
    estimated_completion?: string;
    retry_after_seconds: number;
  };
}
```

**Behavior Modes**:

1. **Immediate mode (wait=false)**:
   - Return current CI status immediately
   - If CI pending/running, return poll_info
   - If completed, return all failures with pagination

2. **Wait mode (wait=true, bail_on_first=true)**:
   - Poll CI status every 10-30 seconds
   - Return immediately on first failure detected
   - Timeout after 30 minutes

3. **Wait mode (wait=true, bail_on_first=false)**:
   - Poll CI status until completion
   - Return all failures with pagination
   - Timeout after 30 minutes

**Error Scenarios**:
- PR not found: `{"error": "PR owner/repo#123 not found", "category": "user"}`
- No CI configured: `{"status": "unknown", "message": "No CI checks configured"}`
- Rate limit: `{"error": "Rate limited", "retry_after": 300}`


---

### 2. find_unresolved_comments

**Purpose**: Find unresolved PR review comments and generate response commands for efficient resolution.

**Use Cases**:
- AI preparing to address reviewer feedback
- Bulk comment triage and resolution
- Filtering out bot nits vs. human concerns
- **NEW**: Extracting actionable suggestions from AI review tools (CodeRabbit, etc.)
- **NEW**: Capturing structured feedback embedded in review bodies

**Input Schema**:
```typescript
interface FindUnresolvedCommentsInput {
  pr: string;                  // Format: "owner/repo#number"
  include_bots?: boolean;      // Include bot comments (default: true) 💾
  exclude_authors?: string[];  // Specific authors to exclude (optional)
  cursor?: string;             // MCP cursor for pagination
  sort?: "chronological" | "by_file" | "by_author"; // Default: chronological 💾
  parse_review_bodies?: boolean; // Parse review bodies for actionable comments (default: true) 💾
}
```

**Output Schema**:
```typescript
interface FindUnresolvedCommentsOutput {
  pr: string;
  total_unresolved: number;
  
  comments: Array<{
    id: number;
    type: "review_comment" | "issue_comment" | "review";
    author: string;
    author_association: "OWNER" | "MEMBER" | "CONTRIBUTOR" | "COLLABORATOR" | "NONE";
    is_bot: boolean;
    created_at: string;
    updated_at: string;
    
    // Location context
    file_path?: string;
    line_number?: number;
    start_line?: number;     // For multi-line comments
    diff_hunk?: string;      // Relevant code snippet
    
    // Comment content
    body: string;
    body_html?: string;      // Rendered HTML if needed
    
    // Thread information
    in_reply_to_id?: number; // If part of a conversation
    
    // Reactions (can help LLM assess resolution)
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
    
    // URLs for reference
    html_url: string;        // Web URL to comment
    
    // **Action commands** - Ready-to-execute GitHub CLI commands and MCP actions
    action_commands: {
      // Reply to comment - agent writes the response content
      reply_command: string;           // e.g., 'gh pr comment 123 --body "YOUR_RESPONSE_HERE"'
      
      // Resolve comment - ONLY run AFTER verifying fix is complete
      resolve_command?: string;        // e.g., 'gh api -X POST .../comments/1234/replies -f body="✅ Fixed"'
      resolve_condition: string;       // e.g., "Run ONLY after verifying fix for: 'SQL injection...'"
      
      // View in browser for context
      view_in_browser: string;         // e.g., 'gh pr view 123 --web'
      
      // MCP action for review thread resolution (only for review_comment type)
      mcp_action?: {                   // MCP tool call - use resolve_review_thread
        tool: "resolve_review_thread";
        args: { pr: string; thread_id: string; };
      };
    };
  }>;
  
  // MCP cursor-based pagination
  nextCursor?: string;  // Opaque cursor, only present if more results exist
  
  // Basic statistics (what tool can know)
  summary: {
    total_comments: number;
    by_author: Record<string, number>;
    by_type: Record<string, number>;
    bot_comments: number;
    human_comments: number;
    with_reactions: number;
  };
}
```

**Review Body Parsing** (NEW Feature):
- **Purpose**: Extracts actionable suggestions from AI review tools like CodeRabbit that embed feedback in review bodies
- **Why Needed**: Traditional GitHub comments miss structured feedback from AI tools that use review bodies instead of individual comments
- **How It Works**: Parses structured markup to extract file context, line ranges, and actionable suggestions
- **Format Support**: Handles CodeRabbit's `<summary>filename (n)</summary>` and `line-range: **suggestion**` patterns
- **Pagination**: Properly handles review body pagination to capture all suggestions across multiple pages
- **Backward Compatible**: Can be disabled with `parse_review_bodies: false` if not needed
- **See**: [REVIEW_BODY_PARSING.md](./REVIEW_BODY_PARSING.md) for detailed documentation

**Bot Detection**:
- Account type from GitHub API (`is_bot` field)
- Can be filtered via `exclude_authors` parameter if desired

**Tool Provides** (what the tool returns):
- Raw comment data with metadata (including CodeRabbit severity markers if present)
- **GitHub CLI reply commands** (agent fills in response text)
- **GitHub CLI resolve commands** (with conditional warnings)

**AI Agent Decides** (what the LLM does with this data):
1. **Analyze** comment body for urgency and category (agent parses CodeRabbit markers, etc.)
2. **Decide** action: fix, discuss, defer, or escalate to human
3. **Generate response content** (agent writes the actual reply text)
4. **Execute reply command** with agent's response text
5. **Make the fix** (edit code, add tests, etc.)
6. **Verify fix** is complete and correct
7. **ONLY THEN call resolve_review_thread MCP tool** (if fully satisfied with fix)

**Critical Workflow**:
```
Comment → Agent reads → Agent decides action → Agent writes response → 
Agent makes fix → Agent verifies fix → Agent calls resolve_review_thread MCP tool
```

**Resolution via MCP**:
- For `review_comment` types, `action_commands.mcp_action` provides ready-to-call MCP action
- Agent must verify fix **completely addresses** all thread concerns before calling
- See `resolve_review_thread` tool docs for strict usage requirements

**Never**: Auto-resolve without verification!


---

### 3. resolve_review_thread 🆕

**Purpose**: Immediately resolve a specific GitHub review thread using GraphQL API.

**⚠️ CRITICAL: Only call this tool AFTER:**
1. The AI has **read and understood** all concerns in the thread
2. The AI has **made code changes** to address those concerns
3. The AI has **verified the fix** (tests pass, requirements met)
4. The AI is **satisfied** the thread's requests are completely fulfilled

**Use Cases**:
- AI needs to resolve a specific review conversation after addressing feedback
- One-shot thread resolution after verification
- Programmatic thread management (with human-like judgment)

**Input Schema**:
```typescript
interface ResolveReviewThreadInput {
  pr: string;                    // Format: "owner/repo#number"
  thread_id?: string;            // Review thread GraphQL node ID
  comment_id?: string;           // Comment GraphQL node ID (will map to thread)
  prefer?: "thread" | "comment"; // Prefer thread or comment when both provided (default: "thread")
}
```

**Output Schema**:
```typescript
interface ResolveReviewThreadOutput {
  ok: boolean;                   // Whether resolution succeeded
  thread_id: string;             // The resolved thread ID
  alreadyResolved: boolean;      // Whether thread was already resolved
  message?: string;              // Additional information
}
```

**GraphQL Integration**:
- Uses `resolveReviewThread` mutation to resolve threads
- Maps comment IDs to thread IDs when needed
- Checks resolution status before attempting resolution

**Tool Philosophy**:
- **One-shot execution**: Immediately resolves the thread (no undo!)
- **Idempotent**: Safe to call on already-resolved threads
- **Smart mapping**: Can resolve via comment ID by looking up the thread
- **AI judgment required**: The AI must exercise judgment like a human reviewer would
  - Don't auto-resolve just because code compiles
  - Ensure the spirit of the feedback is addressed, not just the letter
  - When in doubt, leave unresolved and ask the human

**Example Usage**:
```bash
# Resolve by thread ID
resolve-review-thread --pr owner/repo#123 --thread-id "thread-abc123"

# Resolve by comment ID
resolve-review-thread --pr owner/repo#123 --comment-id "comment-xyz789"
```


---

### 4. manage_stacked_prs

**Purpose**: Manage dependency chains between stacked PRs, detecting when rebases are needed and orchestrating automated fixes.

**Use Cases**:
- Base PR merged, need to update dependent PRs
- Base PR has new commits, need to rebase stack
- Automated rebase-test-fix loop

**Input Schema**:
```typescript
interface ManageStackedPRsInput {
  base_pr: string;           // Earlier PR: "owner/repo#123"
  dependent_pr: string;      // Later PR: "owner/repo#124"
  auto_fix?: boolean;        // Auto-fix test failures (default: true) 💾
  max_iterations?: number;   // Max fix iterations (default: 3)
  use_onto?: boolean;        // Use --onto for rebase (default: auto-detect) 💾
  onto_base?: string;        // Explicit base for --onto (e.g., "main")
  cursor?: string;           // MCP cursor for pagination
}
```

**Output Schema**:
```typescript
interface ManageStackedPRsOutput {
  base_pr: string;
  dependent_pr: string;
  
  // Validation
  is_stacked: boolean;
  stack_info: {
    base_branch: string;     // Base PR's head branch
    dependent_base: string;  // Dependent PR's base branch
    matches: boolean;        // They align correctly
    visualization: string;   // ASCII art of stack
  };
  
  // Change detection
  changes_detected: boolean;
  change_summary?: {
    new_commits_in_base: number;
    commits: Array<{
      sha: string;
      message: string;
      author: string;
      date: string;
    }>;
    files_changed: string[];
    potential_conflicts: string[]; // Files that might conflict
  };
  // Detection of upstream merge
  upstream_merge_detected: boolean;
  squash_merge: boolean;           // Was it a squash merge?
  last_upstream_commit?: string;   // Last commit before your work
  
  // Rebase strategy recommendation
  rebase_strategy: {
    recommended: "regular" | "onto";
    reason: string;
    regular_command?: string;      // Standard rebase command
    onto_command?: string;         // --onto rebase command if applicable
    ai_should_decide: boolean;     // True if both options are valid
    considerations: string[];      // Factors for AI to consider
  };
  
  // Generated command sequence
  commands: Array<{
    step: number;
    type: "git" | "ci_wait" | "test" | "fix" | "verification";
    command: string;
    description: string;
    estimated_duration?: string;
    can_automate: boolean;
    
    // Conditional execution
    skip_if?: string;        // Condition to skip step
    retry_on_failure?: boolean;
    max_retries?: number;
  }>;
  
  // MCP cursor-based pagination
  nextCursor?: string;  // Opaque cursor, only present if more results exist
  
  // Automation status
  automation: {
    enabled: boolean;
    current_step?: number;
    status: "not_started" | "in_progress" | "completed" | "failed";
    error?: string;
  };
  
  // Summary
  summary: {
    action_required: boolean;
    reason: string;
    estimated_total_time: string;
    risk_level: "low" | "medium" | "high";
  };
}
```

**Rebase Strategy Detection**:

The tool analyzes the situation and recommends a strategy:

```typescript
{
  "rebase_strategy": {
    "recommended": "onto",
    "reason": "Base PR #100 was squash-merged into main. Using --onto will skip those commits and only rebase your work.",
    "regular_command": "git rebase pr-100",
    "onto_command": "git rebase --onto origin/main abc123e pr-101-branch",
    "ai_should_decide": false,  // Clear best choice
    "considerations": [
      "Base PR was squash-merged (10 commits → 1 squash commit)",
      "Your PR contains those 10 commits + 3 of your own",
      "Regular rebase would cause 10+ conflicts",
      "--onto rebase will only replay your 3 commits"
    ]
  }
}

// Or when it's ambiguous:
{
  "rebase_strategy": {
    "recommended": "regular",
    "reason": "Base PR was merge-committed (not squashed), regular rebase should work",
    "regular_command": "git rebase pr-100",
    "onto_command": "git rebase --onto origin/main abc123e pr-101-branch",
    "ai_should_decide": true,  // Both are valid options
    "considerations": [
      "Base PR was NOT squash-merged",
      "Regular rebase will replay commits linearly",
      "--onto could still be used if you want to skip intermediate history",
      "Choose based on whether you want to preserve or skip base PR's commits"
    ]
  }
}
```

**Command Generation Examples**:

When base PR has new commits:
```typescript
[
  {
    step: 1,
    type: "git",
    command: "git fetch origin pull/123/head:pr-123",
    description: "Fetch latest changes from base PR",
    can_automate: true
  },
  {
    step: 2,
    type: "git",
    command: "git checkout pr-124 && git rebase pr-123",
    description: "Rebase dependent PR onto base PR",
    can_automate: true,
    retry_on_failure: false
  },
  {
    step: 3,
    type: "git",
    command: "git push --force-with-lease origin pr-124",
    description: "Push rebased branch",
    can_automate: true
  },
  {
    step: 4,
    type: "ci_wait",
    command: "get_failing_tests(pr='owner/repo#124', wait=true, bail_on_first=true)",
    description: "Wait for CI and check for failures",
    estimated_duration: "5-10 minutes",
    can_automate: true
  },
  {
    step: 5,
    type: "fix",
    command: "// AI will apply fixes based on test failures",
    description: "Fix any test failures introduced by rebase",
    can_automate: true,
    skip_if: "No test failures detected"
  }
]
```


---

### 5. detect_merge_conflicts

**Purpose**: Proactively detect merge conflicts before attempting merge.

**Input Schema**:
```typescript
interface DetectMergeConflictsInput {
  pr: string;              // "owner/repo#number"
  target_branch?: string;  // Override base branch
}
```

**Output Schema**:
```typescript
interface DetectMergeConflictsOutput {
  pr: string;
  has_conflicts: boolean;
  
  conflicts?: Array<{
    file_path: string;
    conflict_type: "content" | "rename" | "delete" | "mode";
    base_content_preview: string;
    head_content_preview: string;
    suggested_resolution?: string;
  }>;
  
  mergeable_state: "clean" | "unstable" | "dirty" | "unknown";
  
  instructions?: {
    resolution_steps: string[];
    estimated_time: string;
  };
}
```


---

### 6. check_merge_readiness

**Purpose**: Comprehensive check of all merge requirements.

**Input Schema**:
```typescript
interface CheckMergeReadinessInput {
  pr: string;
}
```

**Output Schema**:
```typescript
interface CheckMergeReadinessOutput {
  pr: string;
  ready_to_merge: boolean;
  
  checks: {
    ci_passing: boolean;
    approvals_met: boolean;
    no_conflicts: boolean;
    up_to_date: boolean;
    branch_protection_satisfied: boolean;
  };
  
  blocking_issues: Array<{
    category: string;
    description: string;
    action_required: string;
  }>;
  
  branch_protection?: {
    required_approvals: number;
    current_approvals: number;
    required_checks: string[];
    passing_checks: string[];
    failing_checks: string[];
  };
}
```


---

### 7. rebase_after_squash_merge

**Purpose**: Generate rebase commands after upstream PR was squash-merged, using --onto strategy.

**Input Schema**:
```typescript
interface RebaseAfterSquashMergeInput {
  pr: string;                    // Your PR identifier (owner/repo#123)
  upstream_pr?: string;          // Upstream PR that was squash-merged (optional, can auto-detect)
  target_branch?: string;        // Target branch (default: PR base branch)
}
```

**Output Schema**:
```typescript
interface RebaseAfterSquashMergeOutput {
  pr: string;
  upstream_pr?: string;
  target_branch: string;
  
  // Rebase strategy analysis
  strategy: {
    recommended: "onto" | "regular";
    reason: string;
    squash_merge_detected: boolean;
    last_upstream_commit?: string;
  };
  
  // Generated commands
  commands: Array<{
    step: number;
    command: string;
    description: string;
    estimated_duration?: string;
  }>;
  
  // Safety checks
  warnings?: string[];
  prerequisites: string[];
}
```


## Common Patterns

### PR Identifier Parsing
Support multiple formats:
- `owner/repo#123`
- `owner/repo/pulls/123`
- `https://github.com/owner/repo/pull/123`

### Pagination (MCP-Compliant Cursor-Based)
All paginated responses use MCP cursor-based pagination:
- `nextCursor?: string` - Opaque base64-encoded cursor
- Only present if more results exist
- Server controls page size (not exposed to client)
- Clients pass cursor to get next page
- Cursors are opaque - clients must not parse or modify them

Reference: https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination

### Error Responses
```typescript
interface ErrorResponse {
  error: string;
  category: "user" | "api" | "logical" | "network" | "authentication" | "authorization" | "rate_limit" | "timeout" | "unknown";
  details?: Record<string, any>;
  suggestion?: string;
  retry_after?: number;
  diagnostic_tool?: string;        // Suggested diagnostic tool
  diagnostic_context?: string;     // Context for diagnostic tool
  diagnostic_command?: string;     // How to use the diagnostic tool
  diagnostic_example?: string;     // Example command/input
}
```

#### Enhanced Error with Diagnostic Tool Suggestion
```json
{
  "error": "Forbidden: insufficient permissions",
  "category": "authorization",
  "suggestion": "Ensure the token has required repository permissions",
  "diagnostic_tool": "check_github_permissions",
  "diagnostic_context": "Permission denied - use diagnostic tool to identify missing scopes",
  "diagnostic_command": "Use MCP tool: check_github_permissions",
  "diagnostic_example": "Example: {\"pr\": \"owner/repo#123\", \"actions\": [\"resolve_threads\"]}"
}
```

### Rate Limiting
- Track GitHub API usage
- Return `retry_after` when rate limited
- Implement exponential backoff internally

## GitHub Permissions Diagnostic Tool

### Purpose
The `check_github_permissions` tool diagnoses GitHub token permissions and provides actionable fix guidance. Use this tool when other MCP tools fail with permission errors to understand what's wrong and how to fix it.

### Input Schema
```typescript
interface CheckPermissionsInput {
  pr: string;                    // PR identifier (owner/repo#123 or URL)
  actions?: PermissionAction[];  // Specific actions to test (optional)
  detailed?: boolean;            // Include detailed diagnostics (default: false)
}

type PermissionAction = 
  | 'read_comments'     // Read PR comments and reviews
  | 'create_comments'   // Create new comments
  | 'resolve_threads'   // Resolve review threads
  | 'merge_pr'          // Merge pull requests
  | 'approve_pr'        // Approve pull requests
  | 'request_changes'   // Request changes on PRs
  | 'read_ci'           // Read CI status and logs
  | 'write_ci';         // Write CI status (not testable safely)
```

### Output Schema
```typescript
interface CheckPermissionsOutput {
  // Basic token validation
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
  
  // Action-specific test results
  action_results: Record<PermissionAction, ActionResult>;
  
  // Diagnostic information
  diagnostics: {
    missing_scopes: string[];           // Required scopes not present
    suggestions: string[];              // Human-readable issue descriptions
    rate_limit_status: 'healthy' | 'warning' | 'critical';
    rate_limit_details: RateLimitInfo;
  };
  
  // Fix recommendations
  fixes: {
    immediate: string[];                // Quick fixes (usually empty)
    token_update: string[];             // Token configuration steps
    alternative_commands: Record<PermissionAction, string>; // GH CLI alternatives
  };
  
  // Overall summary
  summary: {
    overall_status: 'healthy' | 'warning' | 'critical';
    working_actions: PermissionAction[];
    failing_actions: PermissionAction[];
    primary_issue?: string;
  };
}

interface ActionResult {
  allowed: boolean;
  reason?: string;              // Why the action failed
  required_scopes?: string[];   // Scopes needed for this action
  error_details?: string;      // Technical error details
}

interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset_time: string;           // ISO timestamp
  status: 'healthy' | 'warning' | 'critical';
}
```

### Usage Examples

#### Basic Permission Check
```json
{
  "pr": "owner/repo#123"
}
```

#### Specific Action Testing
```json
{
  "pr": "owner/repo#123",
  "actions": ["create_comments", "resolve_threads"],
  "detailed": true
}
```

### Response Examples

#### Healthy Token
```json
{
  "token_valid": true,
  "token_type": "classic",
  "user": "testuser",
  "repository_access": true,
  "repository_permissions": {
    "admin": false,
    "write": true,
    "read": true
  },
  "action_results": {
    "read_comments": { "allowed": true },
    "create_comments": { "allowed": true },
    "resolve_threads": { "allowed": true },
    "merge_pr": { "allowed": true },
    "approve_pr": { "allowed": true },
    "request_changes": { "allowed": true },
    "read_ci": { "allowed": true },
    "write_ci": { "allowed": false, "reason": "CI write permissions not testable safely" }
  },
  "diagnostics": {
    "missing_scopes": [],
    "suggestions": [],
    "rate_limit_status": "healthy",
    "rate_limit_details": {
      "remaining": 4500,
      "limit": 5000,
      "reset_time": "2024-01-01T12:00:00Z",
      "status": "healthy"
    }
  },
  "fixes": {
    "immediate": [],
    "token_update": [],
    "alternative_commands": {}
  },
  "summary": {
    "overall_status": "healthy",
    "working_actions": ["read_comments", "create_comments", "resolve_threads", "merge_pr", "approve_pr", "request_changes", "read_ci"],
    "failing_actions": ["write_ci"],
    "primary_issue": "All tested permissions are healthy"
  }
}
```

#### Critical Permission Issues
```json
{
  "token_valid": false,
  "token_type": "unknown",
  "repository_access": false,
  "repository_permissions": {
    "admin": false,
    "write": false,
    "read": false
  },
  "action_results": {
    "read_comments": { "allowed": false, "reason": "Cannot read review comments", "required_scopes": ["repo"] },
    "create_comments": { "allowed": false, "reason": "Cannot access repository", "required_scopes": ["repo"] },
    "resolve_threads": { "allowed": false, "reason": "Cannot check repository permissions", "required_scopes": ["repo"] }
  },
  "diagnostics": {
    "missing_scopes": ["repo"],
    "suggestions": [
      "❌ Token invalid: Bad credentials",
      "❌ Repository access: Repo not found",
      "❌ read_comments: Cannot read review comments",
      "❌ create_comments: Cannot access repository",
      "❌ resolve_threads: Cannot check repository permissions"
    ],
    "rate_limit_status": "critical",
    "rate_limit_details": {
      "remaining": 0,
      "limit": 0,
      "reset_time": "2024-01-01T12:00:00Z",
      "status": "critical"
    }
  },
  "fixes": {
    "immediate": [],
    "token_update": [
      "Add \"repo\" scope to your GitHub token",
      "Visit: https://github.com/settings/tokens",
      "Edit your token and check the \"repo\" checkbox",
      "This will enable most GitHub operations"
    ],
    "alternative_commands": {
      "read_comments": "gh pr view 123 --repo owner/repo --web",
      "create_comments": "gh pr comment 123 --repo owner/repo --body \"Your response here\"",
      "resolve_threads": "gh pr review 123 --repo owner/repo --comment --body \"✅ Fixed\""
    }
  },
  "summary": {
    "overall_status": "critical",
    "working_actions": [],
    "failing_actions": ["read_comments", "create_comments", "resolve_threads"],
    "primary_issue": "Critical permission issues detected"
  }
}
```

### When to Use This Tool

1. **Permission Errors**: When other MCP tools fail with "Resource not accessible" errors
2. **Token Validation**: To verify your GitHub token is working correctly
3. **Scope Verification**: To check if your token has the required scopes
4. **Repository Access**: To verify you can access the target repository
5. **Rate Limit Monitoring**: To check your API usage status
6. **Troubleshooting**: When GitHub CLI commands work but MCP tools don't

### Safety Features

- **Read-Only Operations**: All diagnostic tests use read-only operations
- **No Side Effects**: Never creates, modifies, or deletes any GitHub resources
- **Safe Testing**: Uses repository permission checks instead of actual write operations
- **Rate Limit Aware**: Monitors but doesn't consume significant API quota

### Integration with Other Tools

When other MCP tools fail with permission errors, they should suggest using this diagnostic tool:

```typescript
// Example error message from other tools
{
  "error": "Resource not accessible by personal access token",
  "category": "api",
  "suggestion": "Use check_github_permissions tool to diagnose token issues",
  "diagnostic_tool": "check_github_permissions"
}
```

<!-- MCP_TOOLS_END -->

