# API Design Specification

> **Philosophy**: See [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) - We're a dumb tool, the agent is smart.
> We fetch data and provide commands. The agent interprets and decides.

## Tool Catalog

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

**Input Schema**:
```typescript
interface FindUnresolvedCommentsInput {
  pr: string;                  // Format: "owner/repo#number"
  include_bots?: boolean;      // Include bot comments (default: true) 💾
  exclude_authors?: string[];  // Specific authors to exclude (optional)
  cursor?: string;             // MCP cursor for pagination
  sort?: "chronological" | "by_file" | "by_author"; // Default: chronological 💾
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
    
    // **Action commands** - Ready-to-execute GitHub CLI commands
    action_commands: {
      // Reply to comment - agent writes the response content
      reply_command: string;           // e.g., 'gh pr comment 123 --body "YOUR_RESPONSE_HERE"'
      
      // Resolve comment - ONLY run AFTER verifying fix is complete
      resolve_command?: string;        // e.g., 'gh api -X POST .../comments/1234/replies -f body="✅ Fixed"'
      resolve_condition: string;       // e.g., "Run ONLY after verifying fix for: 'SQL injection...'"
      
      // View in browser for context
      view_in_browser: string;         // e.g., 'gh pr view 123 --web'
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
7. **ONLY THEN execute resolve command** (if satisfied with fix)

**Critical Workflow**:
```
Comment → Agent reads → Agent decides action → Agent writes response → 
Agent makes fix → Agent verifies fix → Agent resolves comment
```

**Never**: Auto-resolve without verification!

---

### 3. manage_stacked_prs

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

### 4. detect_merge_conflicts

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

### 5. check_merge_readiness

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

### 6. analyze_pr_impact

**Purpose**: Analyze the scope and impact of PR changes.

**Input Schema**:
```typescript
interface AnalyzePRImpactInput {
  pr: string;
  depth?: "summary" | "detailed"; // Default: summary
}
```

**Output Schema**:
```typescript
interface AnalyzePRImpactOutput {
  pr: string;
  
  changes: {
    files_changed: number;
    additions: number;
    deletions: number;
    commits: number;
  };
  
  impact_areas: Array<{
    category: "frontend" | "backend" | "database" | "infrastructure" | "tests" | "docs";
    files: string[];
    risk_level: "low" | "medium" | "high";
  }>;
  
  suggested_reviewers?: Array<{
    username: string;
    reason: string;  // "Previously modified 5 of these files"
    confidence: number;
  }>;
  
  similar_prs?: Array<{
    number: number;
    title: string;
    similarity_score: number;
    outcome: "merged" | "closed";
  }>;
}
```

---

### 7. get_review_suggestions

**Purpose**: Generate structured context optimized for AI code review.

**Input Schema**:
```typescript
interface GetReviewSuggestionsInput {
  pr: string;
  focus_areas?: string[];  // e.g., ["security", "performance"]
  include_diff?: boolean;  // Include code diffs (default: true)
  max_diff_lines?: number; // Limit diff size (default: 500)
}
```

**Output Schema**:
```typescript
interface GetReviewSuggestionsOutput {
  pr: string;
  metadata: {
    title: string;
    description: string;
    author: string;
    labels: string[];
  };
  
  files: Array<{
    path: string;
    status: "added" | "modified" | "deleted" | "renamed";
    additions: number;
    deletions: number;
    diff_excerpt?: string;  // Truncated if needed
    focus_points: string[]; // AI-identified areas to review
  }>;
  
  review_checklist: Array<{
    category: string;
    items: Array<{
      question: string;
      guidance: string;
    }>;
  }>;
  
  context: {
    related_issues: number[];
    mentioned_prs: number[];
    breaking_changes_detected: boolean;
  };
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
  category: "user" | "api" | "logical";
  details?: Record<string, any>;
  suggestion?: string;
  retry_after?: number;
}
```

### Rate Limiting
- Track GitHub API usage
- Return `retry_after` when rate limited
- Implement exponential backoff internally

