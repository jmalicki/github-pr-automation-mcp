# Usage Examples and Workflows

## Quick Start

### Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "resolve-pr": {
      "command": "node",
      "args": ["/path/to/resolve-pr-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

---

## Common Workflows

### Workflow 1: Quick Fix Failed Tests

**Scenario**: Your PR has failing tests and you want to fix them quickly.

**AI Prompt**:
```
My PR owner/repo#123 has failing CI. 
Use get_failing_tests to find the first failure and help me fix it.
```

**MCP Tool Execution**:
```json
{
  "tool": "get_failing_tests",
  "arguments": {
    "pr": "owner/repo#123",
    "wait": true,
    "bail_on_first": true
  }
}
```

**Response**:
```json
{
  "status": "failed",
  "failures": [{
    "check_name": "pytest / unit-tests",
    "test_name": "test_auth.py::test_login_invalid_password",
    "error_message": "AssertionError: expected 401, got 500",
    "file_path": "tests/test_auth.py",
    "line_number": 45,
    "confidence": "high"
  }],
  "instructions": {
    "summary": "1 test failed in authentication module",
    "priority": [{
      "test": "test_login_invalid_password",
      "reason": "First failure detected",
      "suggested_fix": "Check authentication endpoint - returning 500 instead of 401"
    }],
    "commands": [
      "pytest tests/test_auth.py::test_login_invalid_password -v"
    ]
  }
}
```

**AI Follow-up**:
The AI reads the test file, identifies the issue in the authentication endpoint, proposes a fix, and commits it.

---

### Workflow 2: Address All Review Comments

**Scenario**: You have 20 review comments to address and want to batch process them.

**AI Prompt**:
```
Show me all unresolved comments on PR owner/repo#456.
Exclude bot nits for now. Help me address them systematically.
```

**MCP Tool Execution**:
```json
{
  "tool": "find_unresolved_comments",
  "arguments": {
    "pr": "owner/repo#456",
    "include_bots": true,
    "page": 1,
    "page_size": 20,
    "sort": "chronological"
  }
}
```

**Response**:
```json
{
  "total_unresolved": 15,
  "comments": [
    {
      "id": 1234,
      "type": "review_comment",
      "author": "senior-dev",
      "author_association": "MEMBER",
      "is_bot": false,
      "body": "This could lead to SQL injection. Please use parameterized queries.",
      "file_path": "src/db/users.ts",
      "line_number": 42,
      "diff_hunk": "@@ -40,5 +40,7 @@\n const query = `SELECT * FROM users WHERE id = ${userId}`",
      "created_at": "2024-01-15T10:30:00Z",
      "html_url": "https://github.com/owner/repo/pull/456#discussion_r1234",
      "reactions": {
        "total_count": 2,
        "eyes": 2,
        "+1": 0
      }
    },
    {
      "id": 1235,
      "type": "review_comment",
      "author": "teammate",
      "author_association": "CONTRIBUTOR",
      "is_bot": false,
      "body": "Could you add a test for the error case?",
      "file_path": "src/api/handlers.ts",
      "line_number": 67,
      "created_at": "2024-01-15T11:00:00Z",
      "html_url": "https://github.com/owner/repo/pull/456#discussion_r1235"
    },
    {
      "id": 1236,
      "type": "review_comment",
      "author": "coderabbitai",
      "is_bot": true,
      "body": "Nit: Consider using const instead of let here.",
      "file_path": "src/utils/parser.ts",
      "line_number": 15,
      "created_at": "2024-01-15T11:15:00Z",
      "html_url": "https://github.com/owner/repo/pull/456#discussion_r1236"
    }
  ],
  "summary": {
    "total_comments": 15,
    "by_author": {
      "senior-dev": 3,
      "teammate": 5,
      "coderabbitai": 7
    },
    "by_type": {
      "review_comment": 14,
      "issue_comment": 1
    },
    "bot_comments": 7,
    "human_comments": 8,
    "with_reactions": 3
  }
}
```

**AI Workflow**:
The AI now analyzes the raw comments and:
1. Categorizes #1234 as "blocking" due to security keywords
2. Prioritizes it as high severity
3. Addresses the SQL injection concern immediately
4. Categorizes #1235 as "suggestion" - adds requested tests
5. Categorizes #1236 as "nit" from bot - applies simple const fix
6. Generates appropriate responses for each

---

### Workflow 3: Rebase Stacked PRs

**Scenario**: You have a stack of PRs. The base PR got new commits (or was squash-merged) and you need to update the stack.

**AI Prompt**:
```
I have PR #100 as the base and PR #101 depends on it.
PR #100 was just squash-merged. Check if #101 needs to be rebased and help me do it.
```

**MCP Tool Execution**:
```json
{
  "tool": "manage_stacked_prs",
  "arguments": {
    "base_pr": "owner/repo#100",
    "dependent_pr": "owner/repo#101",
    "auto_fix": true,
    "page": 1,
    "page_size": 10
  }
}
```

**Response**:
```json
{
  "is_stacked": true,
  "changes_detected": true,
  "squash_merge": true,
  "change_summary": {
    "new_commits_in_base": 0,  // Base branch was deleted after squash
    "squash_commit_in_main": "def789",
    "commits": [
      {
        "sha": "abc123",
        "message": "Add validation layer",
        "author": "teammate"
      },
      {
        "sha": "def456",
        "message": "Fix edge case",
        "author": "teammate"
      }
    ],
    "potential_conflicts": ["src/api/validators.ts"]
  },
  "rebase_strategy": {
    "recommended": "onto",
    "reason": "Base PR was squash-merged. Using --onto will skip the squashed commits.",
    "regular_command": "git rebase pr-100",
    "onto_command": "git rebase --onto origin/main abc123 pr-101-branch",
    "ai_should_decide": false,
    "considerations": [
      "Base PR #100 was squash-merged (10 commits → 1)",
      "Your PR has those 10 individual commits",
      "--onto will skip them and only rebase your new work"
    ]
  },
  "commands": [
    {
      "step": 1,
      "type": "git",
      "command": "git fetch origin pull/100/head:pr-100",
      "description": "Fetch latest changes from base PR #100"
    },
    {
      "step": 2,
      "type": "git",
      "command": "git checkout -b pr-101-rebase origin/pr-101",
      "description": "Create local branch for PR #101"
    },
    {
      "step": 3,
      "type": "git",
      "command": "git rebase pr-100",
      "description": "Rebase PR #101 onto updated PR #100"
    },
    {
      "step": 4,
      "type": "ci_wait",
      "command": "get_failing_tests(pr='owner/repo#101', wait=true)",
      "description": "Wait for CI and check for new test failures"
    }
  ],
  "summary": {
    "action_required": true,
    "reason": "Base PR has 3 new commits that need to be incorporated",
    "risk_level": "medium",
    "estimated_total_time": "10-15 minutes"
  }
}
```

---

### Workflow 4: Pre-merge Health Check

**Scenario**: Before merging, validate everything is ready.

**AI Prompt**:
```
Check if PR owner/repo#789 is ready to merge.
If not, tell me what's blocking and help fix it.
```

**MCP Tool Execution**:
```json
{
  "tool": "check_merge_readiness",
  "arguments": {
    "pr": "owner/repo#789"
  }
}
```

**Response**:
```json
{
  "ready_to_merge": false,
  "checks": {
    "ci_passing": true,
    "approvals_met": false,
    "no_conflicts": true,
    "up_to_date": true,
    "branch_protection_satisfied": false
  },
  "blocking_issues": [
    {
      "category": "approvals",
      "severity": "error",
      "description": "Need 2 approvals, currently have 1",
      "action_required": "Request review from another team member"
    },
    {
      "category": "protection",
      "severity": "error",
      "description": "Required check 'security-scan' has not run",
      "action_required": "Trigger security-scan workflow manually"
    }
  ],
  "branch_protection": {
    "required_approvals": 2,
    "current_approvals": 1,
    "approving_users": ["alice"],
    "required_checks": ["test", "lint", "security-scan"],
    "passing_checks": ["test", "lint"],
    "failing_checks": [],
    "pending_checks": ["security-scan"]
  }
}
```

**AI Action**:
- Suggests requesting review from Bob or Carol (frequent collaborators)
- Provides command to trigger security-scan workflow

---

### Workflow 5: Detect Conflicts Early

**Scenario**: Check for conflicts before attempting merge.

**AI Prompt**:
```
Check if PR owner/repo#555 has any merge conflicts.
```

**MCP Tool Execution**:
```json
{
  "tool": "detect_merge_conflicts",
  "arguments": {
    "pr": "owner/repo#555"
  }
}
```

**Response (with conflicts)**:
```json
{
  "has_conflicts": true,
  "conflicts": [
    {
      "file_path": "src/config/settings.ts",
      "conflict_type": "content",
      "base_content_preview": "export const API_URL = 'https://api.prod.com';",
      "head_content_preview": "export const API_URL = 'https://api-v2.prod.com';",
      "suggested_resolution": "Both branches modified API_URL. Choose the correct endpoint or make it configurable."
    }
  ],
  "mergeable_state": "dirty",
  "instructions": {
    "resolution_steps": [
      "git checkout pr-555",
      "git merge origin/main",
      "# Resolve conflicts in src/config/settings.ts",
      "git add src/config/settings.ts",
      "git commit -m 'Resolve merge conflicts'",
      "git push"
    ],
    "estimated_time": "5 minutes"
  }
}
```

---

## Advanced Workflows

### Workflow 6: Analyze Large PR Before Review

**Scenario**: Large PR lands in your queue, need to understand scope.

**AI Prompt**:
```
Analyze PR owner/repo#999 and give me a review strategy.
```

**Step 1: Analyze Impact**
```json
{
  "tool": "analyze_pr_impact",
  "arguments": {
    "pr": "owner/repo#999",
    "depth": "detailed"
  }
}
```

**Response**:
```json
{
  "changes": {
    "files_changed": 47,
    "additions": 2341,
    "deletions": 892,
    "commits": 23
  },
  "impact_areas": [
    {
      "category": "backend",
      "files": ["src/api/**"],
      "lines_changed": 1500,
      "risk_level": "high"
    },
    {
      "category": "database",
      "files": ["migrations/", "src/models/**"],
      "lines_changed": 450,
      "risk_level": "high"
    },
    {
      "category": "tests",
      "files": ["tests/**"],
      "lines_changed": 1283,
      "risk_level": "low"
    }
  ],
  "suggested_reviewers": [
    {
      "username": "backend-expert",
      "relevance_score": 95,
      "reason": "Modified 12 files they previously touched",
      "expertise_areas": ["api-design", "database"]
    }
  ],
  "overall_risk": "high",
  "risk_factors": [
    {
      "factor": "Large changeset",
      "severity": "high",
      "description": "2341 lines added across 47 files"
    },
    {
      "factor": "Database schema changes",
      "severity": "high",
      "description": "3 migrations affecting core tables"
    }
  ]
}
```

**Step 2: Get Review Context**
```json
{
  "tool": "get_review_suggestions",
  "arguments": {
    "pr": "owner/repo#999",
    "focus_areas": ["security", "performance", "database"],
    "max_diff_lines": 1000
  }
}
```

**Response**:
```json
{
  "files": [
    {
      "path": "src/api/auth.ts",
      "status": "modified",
      "additions": 234,
      "deletions": 45,
      "focus_points": [
        {
          "type": "security",
          "line_range": [42, 67],
          "description": "New authentication flow - verify token validation",
          "severity": "critical"
        },
        {
          "type": "performance",
          "line_range": [89, 112],
          "description": "Database query in loop - potential N+1 issue",
          "severity": "warning"
        }
      ]
    }
  ],
  "review_checklist": [
    {
      "category": "Security",
      "items": [
        {
          "question": "Are all user inputs properly validated?",
          "guidance": "Check authentication parameters, SQL injection risks",
          "priority": "required"
        }
      ]
    },
    {
      "category": "Database",
      "items": [
        {
          "question": "Are migrations reversible?",
          "guidance": "Check for down() methods in migration files",
          "priority": "required"
        },
        {
          "question": "Is data properly indexed?",
          "guidance": "Review query performance implications",
          "priority": "recommended"
        }
      ]
    }
  ],
  "context": {
    "related_issues": [234, 245],
    "breaking_changes_detected": true
  }
}
```

**AI Output**:
Provides a structured review strategy:
1. Start with security-critical files (auth.ts)
2. Review database migrations for reversibility
3. Check for performance issues (N+1 queries identified)
4. Recommend involving backend-expert for thorough review

---

### Workflow 7: Automated Fix Loop for Stacked PRs

**Scenario**: Base PR merged, need to update and fix entire stack.

**AI Prompt**:
```
PR #200 just merged. I have PRs #201, #202, #203 stacked on it.
Update the entire stack and fix any test failures automatically.
```

**Sequence**:

1. **Update PR #201**
```json
{
  "tool": "manage_stacked_prs",
  "arguments": {
    "base_pr": "owner/repo#200",
    "dependent_pr": "owner/repo#201"
  }
}
```

2. **Check for failures**
```json
{
  "tool": "get_failing_tests",
  "arguments": {
    "pr": "owner/repo#201",
    "wait": true
  }
}
```

3. **If failures found, AI applies fixes, then moves to #202**

4. **Repeat for #202 → #201**
```json
{
  "tool": "manage_stacked_prs",
  "arguments": {
    "base_pr": "owner/repo#201",
    "dependent_pr": "owner/repo#202"
  }
}
```

5. **Finally #203 → #202**

---

## Integration with AI Agents

### Claude Desktop Example

**User**: "Fix my PR tests"

**Claude**: Uses MCP to:
1. Call `get_failing_tests` to identify failures
2. Read the failing test files
3. Read the implementation files
4. Propose and apply fixes
5. Commit changes
6. Wait for CI to re-run
7. Verify fixes worked

### Cursor / VS Code Example

**User**: "Review this PR for me"

**AI**: Uses MCP to:
1. Call `analyze_pr_impact` to understand scope
2. Call `get_review_suggestions` for checklist
3. Call `find_unresolved_comments` to see existing feedback
4. Generate comprehensive review
5. Add comments to PR

---

## Command-Line Usage (CLI Mode)

The tools can be invoked directly from the command line:

```bash
# Get failing tests
resolve-pr-mcp get-failing-tests --pr "owner/repo#123" --wait --bail-on-first

# Find unresolved comments  
resolve-pr-mcp find-unresolved-comments --pr "owner/repo#456" --page 1 --page-size 20

# Manage stacked PRs
resolve-pr-mcp manage-stacked-prs \
  --base-pr "owner/repo#100" \
  --dependent-pr "owner/repo#101"

# Check merge readiness
resolve-pr-mcp check-merge-readiness --pr "owner/repo#789"

# Output as JSON for scripting
resolve-pr-mcp get-failing-tests --pr "owner/repo#123" --json | jq '.failures[0]'

# Use in shell scripts
if resolve-pr-mcp check-merge-readiness --pr "owner/repo#123" --json | jq -e '.ready_to_merge'; then
  echo "Ready to merge!"
else
  echo "Not ready yet"
fi
```

### CLI in CI/CD Pipelines

```yaml
# .github/workflows/check-pr.yml
name: Check PR Status

on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install resolve-pr-mcp
        run: npm install -g resolve-pr-mcp
      
      - name: Check for failing tests
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER=${{ github.event.pull_request.number }}
          REPO=${{ github.repository }}
          
          resolve-pr-mcp get-failing-tests \
            --pr "$REPO#$PR_NUMBER" \
            --json > failures.json
          
          if [ $(jq '.failures | length' failures.json) -gt 0 ]; then
            echo "Tests are failing!"
            exit 1
          fi
```

---

## Best Practices

### 1. Progressive Detail

Start with summaries, drill down as needed:

```
1. check_merge_readiness (quick overview)
2. If issues found, use specific tools
3. get_failing_tests for CI problems
4. find_unresolved_comments for review issues
```

### 2. Pagination Strategy

For large datasets:

```
- Use default page sizes initially
- Only increase if needed
- Process page by page for memory efficiency
```

### 3. Wait vs. Immediate

**Use wait=true when**:
- You're actively fixing issues
- Fast feedback loops
- Bail on first failure

**Use wait=false when**:
- Just checking status
- Will come back later
- Polling externally

### 4. Error Recovery

When operations fail:

```javascript
// AI should retry with exponential backoff
try {
  result = await mcp.call('get_failing_tests', {pr: 'owner/repo#123'});
} catch (error) {
  if (error.category === 'rate_limit') {
    // Wait as suggested
    await sleep(error.retry_after * 1000);
    result = await mcp.call('get_failing_tests', {pr: 'owner/repo#123'});
  }
}
```

---

## Troubleshooting

### Issue: "PR not found"

**Causes**:
- Typo in PR identifier
- Repository is private and token lacks access
- PR has been closed/deleted

**Solution**:
```
Verify PR exists: https://github.com/owner/repo/pull/123
Check token permissions: repo scope required
```

### Issue: "Rate limit exceeded"

**Causes**:
- Making too many API calls
- Shared token with other services

**Solution**:
```
Wait for rate limit reset (check retry_after field)
Consider dedicated token for MCP server
Reduce polling frequency
```

### Issue: "No CI checks found"

**Causes**:
- Repository doesn't have CI configured
- PR is in draft (CI doesn't run)
- CI workflow has been deleted

**Solution**:
```
Check if CI is configured in .github/workflows/
Convert draft PR to ready for review
Verify workflow file is valid
```

---

## Real-World Examples

### Example 1: Daily PR Triage

**Morning Routine**:
```
For each PR awaiting my review:
1. analyze_pr_impact - understand scope
2. check_merge_readiness - see if ready
3. get_review_suggestions - get checklist
4. Review and comment
```

### Example 2: Pre-Merge Checklist

**Before hitting merge**:
```
1. get_failing_tests - ensure CI passes
2. find_unresolved_comments - address all feedback
3. check_merge_readiness - verify requirements
4. detect_merge_conflicts - no conflicts
5. Merge!
```

### Example 3: Maintaining PR Stack

**Weekly stack maintenance**:
```
For each stack:
1. manage_stacked_prs for each pair
2. Rebase as needed
3. Fix tests with get_failing_tests
4. Keep stack healthy
```

This usage guide demonstrates the practical application of all MCP tools in real-world scenarios.

