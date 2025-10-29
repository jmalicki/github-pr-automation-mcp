# GitHub API Integration Guide

## Authentication Strategy

### Token Requirements

The MCP server requires a GitHub Personal Access Token (PAT) with the following scopes:

**Required Scopes**:

- `repo` - Full control of private repositories
  - Includes: `repo:status`, `repo_deployment`, `public_repo`
  - Needed for: Accessing PR data, check runs, comments
- `read:org` - Read organization membership
  - Needed for: Determining user associations, team mentions

**Optional Scopes** (for enhanced features):

- `write:discussion` - For creating/updating review comments
- `workflow` - For triggering GitHub Actions workflows

### Token Validation

```typescript
// src/github/auth.ts
async function validateToken(octokit: Octokit): Promise<ValidationResult> {
  try {
    // 1. Check token validity
    const { data: user } = await octokit.users.getAuthenticated();
    
    // 2. Check scopes
    const { headers } = await octokit.request('GET /user');
    const scopes = headers['x-oauth-scopes']?.split(', ') || [];
    
    // 3. Validate required scopes
    const hasRepo = scopes.includes('repo') || scopes.includes('public_repo');
    const hasOrg = scopes.includes('read:org');
    
    if (!hasRepo) {
      return {
        valid: false,
        error: 'Token missing required "repo" scope'
      };
    }
    
    return {
      valid: true,
      user: user.login,
      scopes: scopes
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid token or network error'
    };
  }
}
```

---

## Rate Limiting Strategy

### GitHub Rate Limits

- **Authenticated requests**: 5,000 per hour
- **Search API**: 30 requests per minute
- **GraphQL API**: 5,000 points per hour

### Implementation

```typescript
// src/github/rate-limiter.ts
class RateLimiter {
  private remaining: number = 5000;
  private resetAt: Date | null = null;
  private requestQueue: Array<() => Promise<any>> = [];
  
  async checkAndWait(): Promise<void> {
    // Check current rate limit status
    if (this.remaining < 100) {
      const waitMs = this.resetAt 
        ? this.resetAt.getTime() - Date.now()
        : 60000; // Default 1 minute
      
      console.warn(`Rate limit low (${this.remaining} remaining), waiting ${waitMs}ms`);
      await this.sleep(waitMs);
    }
  }
  
  updateFromHeaders(headers: any): void {
    this.remaining = parseInt(headers['x-ratelimit-remaining'] || '5000');
    this.resetAt = new Date(parseInt(headers['x-ratelimit-reset'] || '0') * 1000);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Optimization Strategies

1. **Request Batching**: Combine related API calls
2. **Caching**: Cache responses with appropriate TTL
3. **Conditional Requests**: Use ETags when possible
4. **GraphQL**: Use for complex queries to reduce request count

---

## API Endpoints Reference

### Pull Requests

#### Get Pull Request

```typescript
GET /repos/{owner}/{repo}/pulls/{pull_number}

// Usage
const { data: pr } = await octokit.pulls.get({
  owner: 'octocat',
  repo: 'hello-world',
  pull_number: 123
});

// Key fields:
// - pr.number
// - pr.title, pr.body
// - pr.head.sha, pr.base.sha
// - pr.mergeable, pr.mergeable_state
// - pr.user
```

#### List Pull Request Files

```typescript
GET /repos/{owner}/{repo}/pulls/{pull_number}/files

// Pagination support
const files = await octokit.paginate(octokit.pulls.listFiles, {
  owner: 'octocat',
  repo: 'hello-world',
  pull_number: 123,
  per_page: 100
});

// Returns: filename, status, additions, deletions, patch
```

### Check Runs & Status

#### List Check Runs for a Ref

```typescript
GET /repos/{owner}/{repo}/commits/{ref}/check-runs

const { data } = await octokit.checks.listForRef({
  owner: 'octocat',
  repo: 'hello-world',
  ref: 'main' // or SHA
});

// data.check_runs[] contains:
// - id, name, status, conclusion
// - started_at, completed_at
// - output.title, output.summary, output.text
// - html_url
```

#### Get Check Run

```typescript
GET /repos/{owner}/{repo}/check-runs/{check_run_id}

const { data } = await octokit.checks.get({
  owner: 'octocat',
  repo: 'hello-world',
  check_run_id: 4
});

// Full details including logs
```

### Workflow Runs

#### List Workflow Runs for PR

```typescript
GET /repos/{owner}/{repo}/actions/runs

const { data } = await octokit.actions.listWorkflowRunsForRepo({
  owner: 'octocat',
  repo: 'hello-world',
  event: 'pull_request',
  per_page: 10
});

// Filter by PR using:
// - workflow_runs[].pull_requests[]
```

#### Get Workflow Run

```typescript
GET /repos/{owner}/{repo}/actions/runs/{run_id}

const { data } = await octokit.actions.getWorkflowRun({
  owner: 'octocat',
  repo: 'hello-world',
  run_id: 123
});
```

#### Download Logs

```typescript
GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs

const logs = await octokit.actions.downloadWorkflowRunLogs({
  owner: 'octocat',
  repo: 'hello-world',
  run_id: 123
});

// Returns: ZIP file buffer
// Need to extract and parse
```

### Comments & Reviews

#### List Review Comments

```typescript
GET /repos/{owner}/{repo}/pulls/{pull_number}/comments

const comments = await octokit.paginate(octokit.pulls.listReviewComments, {
  owner: 'octocat',
  repo: 'hello-world',
  pull_number: 123
});

// Returns: review comments on specific lines
```

#### List Issue Comments

```typescript
GET /repos/{owner}/{repo}/issues/{issue_number}/comments

const comments = await octokit.paginate(octokit.issues.listComments, {
  owner: 'octocat',
  repo: 'hello-world',
  issue_number: 123
});

// Returns: general PR comments
```

#### List Reviews

```typescript
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews

const reviews = await octokit.paginate(octokit.pulls.listReviews, {
  owner: 'octocat',
  repo: 'hello-world',
  pull_number: 123
});

// Each review has:
// - id, user, body, state
// - state: APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED
```

### Repository Information

#### Get Branch Protection

```typescript
GET /repos/{owner}/{repo}/branches/{branch}/protection

const { data } = await octokit.repos.getBranchProtection({
  owner: 'octocat',
  repo: 'hello-world',
  branch: 'main'
});

// Returns protection rules:
// - required_status_checks
// - required_pull_request_reviews
// - restrictions
```

#### Compare Commits

```typescript
GET /repos/{owner}/{repo}/compare/{base}...{head}

const { data } = await octokit.repos.compareCommits({
  owner: 'octocat',
  repo: 'hello-world',
  base: 'main',
  head: 'feature-branch'
});

// Returns:
// - commits, files
// - ahead_by, behind_by
```

---

## Common Patterns

### Pattern 1: Fetching PR with Full Context

```typescript
async function getPRWithContext(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  pull_number: number
) {
  // Parallel fetches for efficiency
  const [pr, files, comments, reviews, checkRuns] = await Promise.all([
    octokit.pulls.get({ owner, repo, pull_number }),
    octokit.paginate(octokit.pulls.listFiles, { owner, repo, pull_number }),
    octokit.paginate(octokit.pulls.listReviewComments, { owner, repo, pull_number }),
    octokit.paginate(octokit.pulls.listReviews, { owner, repo, pull_number }),
    octokit.checks.listForRef({ owner, repo, ref: pr.data.head.sha })
  ]);
  
  return {
    pr: pr.data,
    files,
    comments,
    reviews,
    checkRuns: checkRuns.data.check_runs
  };
}
```

### Pattern 2: Polling for CI Completion

```typescript
async function waitForCICompletion(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  options: {
    timeout: number;
    interval: number;
    bailOnFirst: boolean;
  }
): Promise<CheckRun[]> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < options.timeout) {
    const { data } = await octokit.checks.listForRef({ owner, repo, ref });
    const checkRuns = data.check_runs;
    
    // Check for completion
    const pending = checkRuns.filter(run => run.status !== 'completed');
    const failed = checkRuns.filter(run => 
      run.status === 'completed' && run.conclusion === 'failure'
    );
    
    // Bail on first failure
    if (options.bailOnFirst && failed.length > 0) {
      return failed;
    }
    
    // All complete
    if (pending.length === 0) {
      return checkRuns;
    }
    
    // Wait before next poll
    await sleep(options.interval);
  }
  
  throw new Error('Timeout waiting for CI completion');
}
```

### Pattern 3: Extracting Test Failures from Logs

```typescript
async function extractTestFailures(
  octokit: Octokit,
  owner: string,
  repo: string,
  runId: number
): Promise<FailedTest[]> {
  // Download logs
  const response = await octokit.actions.downloadWorkflowRunLogs({
    owner,
    repo,
    run_id: runId
  });
  
  // Logs come as ZIP, need to extract
  const zip = await JSZip.loadAsync(response.data);
  const failures: FailedTest[] = [];
  
  // Process each log file
  for (const [filename, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    
    const content = await file.async('string');
    
    // Parse based on test framework
    if (filename.includes('pytest')) {
      failures.push(...parsePytestLogs(content));
    } else if (filename.includes('jest')) {
      failures.push(...parseJestLogs(content));
    }
    // ... other frameworks
  }
  
  return failures;
}
```

### Pattern 4: Fetching Comments with Thread Structure

```typescript
async function getCommentsWithThreads(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number
): Promise<Comment[]> {
  // Fetch all review comments
  const reviewComments = await octokit.paginate(
    octokit.pulls.listReviewComments,
    { owner, repo, pull_number }
  );
  
  // Fetch all issue comments (general PR comments)
  const issueComments = await octokit.paginate(
    octokit.issues.listComments,
    { owner, repo, issue_number: pull_number }
  );
  
  // Combine and normalize
  const allComments = [
    ...reviewComments.map(c => ({
      ...c,
      type: 'review_comment' as const
    })),
    ...issueComments.map(c => ({
      ...c,
      type: 'issue_comment' as const
    }))
  ];
  
  // Sort chronologically
  allComments.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  return allComments;
}

// Build conversation threads for analysis
function buildThreads(comments: Comment[]): Map<number, Comment[]> {
  const threads = new Map<number, Comment[]>();
  
  for (const comment of comments) {
    const threadId = comment.in_reply_to_id || comment.id;
    if (!threads.has(threadId)) {
      threads.set(threadId, []);
    }
    threads.get(threadId)!.push(comment);
  }
  
  return threads;
}

// Note: Resolution detection is done via simple heuristics
// The LLM will make the final determination about resolution status
function isLikelyResolved(thread: Comment[]): boolean {
  const latest = thread[thread.length - 1];
  
  // Simple heuristics - not definitive
  const resolvedKeywords = /\b(fixed|done|resolved|addressed|updated)\b/i;
  
  if (resolvedKeywords.test(latest.body)) {
    return true;
  }
  
  // Positive reactions suggest resolution
  if (latest.reactions && latest.reactions['+1'] > 0) {
    return true;
  }
  
  return false;
}
```

### Pattern 5: Verifying Stacked PRs

```typescript
async function verifyStackedPRs(
  octokit: Octokit,
  basePR: PRIdentifier,
  dependentPR: PRIdentifier
): Promise<StackValidation> {
  // Fetch both PRs
  const [base, dependent] = await Promise.all([
    octokit.pulls.get({ 
      owner: basePR.owner, 
      repo: basePR.repo, 
      pull_number: basePR.number 
    }),
    octokit.pulls.get({ 
      owner: dependentPR.owner, 
      repo: dependentPR.repo, 
      pull_number: dependentPR.number 
    })
  ]);
  
  // Check if they're in the same repo
  if (basePR.owner !== dependentPR.owner || basePR.repo !== dependentPR.repo) {
    return {
      is_stacked: false,
      valid: false,
      issues: ['PRs must be in the same repository']
    };
  }
  
  // Check if base PR's head branch == dependent PR's base branch
  const baseHeadBranch = base.data.head.ref;
  const dependentBaseBranch = dependent.data.base.ref;
  
  if (baseHeadBranch !== dependentBaseBranch) {
    return {
      is_stacked: false,
      valid: false,
      issues: [
        `Base PR's head branch (${baseHeadBranch}) does not match ` +
        `dependent PR's base branch (${dependentBaseBranch})`
      ]
    };
  }
  
  // Check for new commits in base
  const comparison = await octokit.repos.compareCommits({
    owner: basePR.owner,
    repo: basePR.repo,
    base: dependent.data.head.sha,
    head: base.data.head.sha
  });
  
  return {
    is_stacked: true,
    valid: true,
    issues: [],
    new_commits_in_base: comparison.data.ahead_by,
    behind_by: comparison.data.behind_by
  };
}
```

---

## Error Handling

### Common Error Scenarios

```typescript
async function handleGitHubAPICall<T>(
  apiCall: () => Promise<T>,
  context: string
): Promise<Result<T>> {
  try {
    const result = await apiCall();
    return { success: true, data: result };
  } catch (error: any) {
    // 404 - Not Found
    if (error.status === 404) {
      return {
        success: false,
        error: {
          error: `Resource not found: ${context}`,
          category: 'user',
          suggestion: 'Verify the PR number and repository name are correct'
        }
      };
    }
    
    // 401 - Unauthorized
    if (error.status === 401) {
      return {
        success: false,
        error: {
          error: 'Authentication failed',
          category: 'authentication',
          suggestion: 'Check that GITHUB_TOKEN is set and valid'
        }
      };
    }
    
    // 403 - Forbidden (often rate limiting)
    if (error.status === 403) {
      const rateLimitReset = error.response?.headers['x-ratelimit-reset'];
      const resetTime = rateLimitReset 
        ? new Date(parseInt(rateLimitReset) * 1000)
        : null;
      
      return {
        success: false,
        error: {
          error: 'Rate limit exceeded',
          category: 'rate_limit',
          retry_after: resetTime 
            ? Math.ceil((resetTime.getTime() - Date.now()) / 1000)
            : 3600,
          suggestion: 'Wait for rate limit to reset'
        }
      };
    }
    
    // 422 - Validation Failed
    if (error.status === 422) {
      return {
        success: false,
        error: {
          error: `Invalid request: ${error.message}`,
          category: 'user',
          details: error.response?.data?.errors
        }
      };
    }
    
    // Network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: {
          error: 'Network error',
          category: 'network',
          suggestion: 'Check your internet connection'
        }
      };
    }
    
    // Unknown error
    return {
      success: false,
      error: {
        error: `Unexpected error: ${error.message}`,
        category: 'unknown',
        details: { stack: error.stack }
      }
    };
  }
}
```

### Retry Strategy

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  }
): Promise<T> {
  let lastError: Error;
  let delay = options.initialDelay;
  
  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on 4xx errors (except 429 rate limit)
      if (error.status && error.status >= 400 && error.status < 500) {
        if (error.status !== 429) {
          throw error;
        }
      }
      
      // Wait before retry
      await sleep(delay);
      delay = Math.min(delay * options.backoffMultiplier, options.maxDelay);
    }
  }
  
  throw lastError!;
}
```

---

## Performance Optimization

### Caching Strategy

```typescript
class CachedGitHubClient {
  private cache = new Map<string, { data: any; expiry: number }>();
  
  async getCached<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }
    
    const data = await fetcher();
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
    
    return data;
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// Usage
const pr = await cachedClient.getCached(
  `pr:${owner}/${repo}#${number}`,
  30000, // 30 second TTL
  () => octokit.pulls.get({ owner, repo, pull_number: number })
);
```

### Request Batching

```typescript
class BatchedGitHubClient {
  private batchQueue: Array<{
    key: string;
    resolver: (data: any) => void;
    rejector: (error: any) => void;
  }> = [];
  
  private batchTimeout: NodeJS.Timeout | null = null;
  
  async batchGet(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ key, resolver: resolve, rejector: reject });
      
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.executeBatch(), 10);
      }
    });
  }
  
  private async executeBatch(): Promise<void> {
    const batch = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimeout = null;
    
    // Group by API endpoint
    const groups = this.groupByEndpoint(batch);
    
    // Execute each group
    for (const [endpoint, items] of groups) {
      try {
        const results = await this.fetchBatch(endpoint, items);
        items.forEach((item, i) => item.resolver(results[i]));
      } catch (error) {
        items.forEach(item => item.rejector(error));
      }
    }
  }
}
```

This comprehensive guide covers all major GitHub API integration patterns needed for the MCP server.
