# Architecture Design

## Overview

The Resolve PR MCP Server is designed as a stateless service that bridges AI agents with GitHub's API, providing high-level automation primitives for PR management. The architecture prioritizes token efficiency, pagination, and actionable outputs.

## Transport: stdio (Not HTTP)

**Important**: MCP servers communicate via **stdio (standard input/output)**, not HTTP.

- **No HTTP server**: No ports, no daemon, no network exposure
- **Process lifecycle**: MCP client spawns server as subprocess when needed
- **Communication**: JSON-RPC over stdin/stdout
- **Security**: Isolated process, no network attack surface
- **Simplicity**: Client handles process management

```typescript
// Server connects to stdio transport
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
// Now listening on stdin/stdout
```

The client (Claude Desktop, etc.) spawns the process:
```bash
node /path/to/dist/index.js
# Server reads from stdin, writes to stdout
# No HTTP server running!
```

### CLI Mode (Bonus)

For testing and direct usage, a CLI mode is also available:

```bash
# Direct invocation
resolve-pr-mcp get-failing-tests --pr "owner/repo#123" --wait

# Returns formatted output or JSON
resolve-pr-mcp get-failing-tests --pr "owner/repo#123" --json
```

**CLI vs MCP Mode**:
- **MCP Mode** (primary): stdio transport for AI agent integration
- **CLI Mode** (supplementary): Command-line tool for testing, scripts, CI/CD

## Design Principles

### 1. Token Efficiency
- **Problem**: AI agents have finite context windows; GitHub APIs return verbose data
- **Solution**: Pre-process and filter data to return only actionable information
- **Example**: Instead of returning full CI logs, extract and return only failing test names and error messages

### 2. Actionability
- **Problem**: AI agents need clear instructions, not raw data
- **Solution**: Every tool returns structured commands or instructions the AI can execute
- **Example**: Return "Run: `git rebase origin/pr-123`" instead of "PR 123 has new commits"

### 3. Incremental Processing
- **Problem**: Large PRs can have hundreds of comments or test failures
- **Solution**: Mandatory pagination with sensible defaults
- **Example**: Show 20 comments at a time with summary of total remaining

### 4. Fail-Fast Options
- **Problem**: Waiting for entire CI suite wastes time when early failures exist
- **Solution**: "Bail on first failure" mode for rapid feedback loops
- **Example**: Return first test failure immediately rather than waiting for 50 tests

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AI Agent (Claude Desktop)                  │
│                  Spawns server as subprocess                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ MCP Protocol (stdio/JSON-RPC)
                              │ stdin/stdout - no HTTP server!
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                    MCP Server (Node.js/TypeScript)            │
│                      Process started on-demand                │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Tool Handlers Layer                      │   │
│  │  - get_failing_tests                                  │   │
│  │  - find_unresolved_comments                           │   │
│  │  - manage_stacked_prs                                 │   │
│  │  - detect_merge_conflicts                             │   │
│  │  - check_merge_readiness                              │   │
│  │  - analyze_pr_impact                                  │   │
│  │  - get_review_suggestions                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                                 │
│  ┌──────────────────────────▼──────────────────────────┐    │
│  │           GitHub Integration Layer                    │    │
│  │  - CI Status Fetcher                                 │    │
│  │  - Comment Manager                                   │    │
│  │  - PR Relationship Analyzer                          │    │
│  │  - Diff Analyzer                                     │    │
│  │  - Check Run Processor                               │    │
│  └──────────────────────────────────────────────────────┘   │
│                              │                                 │
│  ┌──────────────────────────▼──────────────────────────┐    │
│  │              Octokit Client                           │    │
│  │  - Rate limiting                                     │    │
│  │  - Authentication                                    │    │
│  │  - Request/Response handling                         │    │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS REST API
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                        GitHub API                              │
│  - Pull Requests                                              │
│  - Check Runs / Workflows                                     │
│  - Comments / Reviews                                         │
│  - Commits / References                                       │
└────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Tool Handlers Layer
**Purpose**: Implement MCP tool interfaces with input validation and response formatting

**Responsibilities**:
- Parse and validate tool arguments using Zod schemas
- Orchestrate calls to GitHub Integration Layer
- Format responses for optimal AI consumption
- Handle pagination logic
- Generate actionable instructions

**Key Patterns**:
```typescript
// Consistent tool handler pattern
async function handleTool(args: ValidatedArgs): Promise<ToolResponse> {
  // 1. Fetch data from GitHub Integration Layer
  const data = await githubLayer.fetchData(args);
  
  // 2. Process and filter for relevance
  const filtered = processData(data, args);
  
  // 3. Generate actionable instructions
  const instructions = generateInstructions(filtered);
  
  // 4. Apply pagination
  const paginated = applyPagination(instructions, args.page, args.page_size);
  
  // 5. Return structured response
  return {
    content: formatForAI(paginated),
    hasMore: paginated.hasNextPage,
    summary: generateSummary(filtered)
  };
}
```

### GitHub Integration Layer
**Purpose**: Abstract GitHub API complexities and provide domain-specific operations

**Responsibilities**:
- Aggregate multiple GitHub API calls into logical operations
- Handle GitHub API pagination
- Parse GitHub-specific data structures (check runs, workflows, etc.)
- Implement retry logic for transient failures
- Cache frequently accessed data (optional optimization)

**Key Modules**:
- `CIStatusFetcher`: Fetches and interprets check runs, workflow runs, and status checks
- `CommentManager`: CRUD operations for PR comments and review threads
- `PRAnalyzer`: Analyzes PR relationships, diffs, and metadata
- `ConflictDetector`: Simulates merges to detect conflicts

### Octokit Client Layer
**Purpose**: Thin wrapper around Octokit with authentication and rate limiting

**Responsibilities**:
- Initialize Octokit with authentication
- Handle rate limiting gracefully
- Log API usage for debugging
- Provide typed API access

## Data Flow Examples

### Example 1: get_failing_tests with wait=false

```
1. AI → MCP: get_failing_tests(pr="org/repo#123", wait=false)
2. MCP → GitHub: GET /repos/org/repo/pulls/123
3. GitHub → MCP: PR data with head SHA
4. MCP → GitHub: GET /repos/org/repo/commits/{sha}/check-runs
5. GitHub → MCP: Check runs list
6. MCP processes: Filter failed checks, extract test names
7. MCP → AI: {
     status: "failed",
     failures: [
       {test: "test_login", error: "AssertionError: expected 200, got 401"},
       {test: "test_signup", error: "Timeout after 30s"}
     ],
     instructions: "Fix authentication in login endpoint...",
     page: 1,
     total_pages: 1
   }
```

### Example 2: manage_stacked_prs

```
1. AI → MCP: manage_stacked_prs(base_pr="org/repo#123", dependent_pr="org/repo#124")
2. MCP → GitHub: GET both PRs
3. MCP verifies: PR #124's base branch == PR #123's head branch
4. MCP → GitHub: GET commits for both PRs
5. MCP detects: PR #123 has 2 new commits not in #124
6. MCP generates commands:
   [
     "git fetch origin pull/123/head:pr-123",
     "git checkout pr-124",
     "git rebase pr-123",
     "git push --force-with-lease",
     "Wait for CI...",
     "Run: get_failing_tests(pr='org/repo#124', wait=true)"
   ]
7. MCP → AI: Paginated command list with explanations
```

## Error Handling Strategy

### Categories of Errors

1. **User Input Errors**
   - Invalid PR format
   - Non-existent PR
   - Response: Clear error message with example

2. **GitHub API Errors**
   - Rate limiting
   - Authentication failure
   - Temporary unavailability
   - Response: Retry with exponential backoff, then fail gracefully

3. **Logical Errors**
   - PRs not stacked as expected
   - No CI configured
   - Response: Explain the issue and suggest alternatives

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;           // Human-readable error message
  category: "user" | "api" | "logical";
  suggestion?: string;     // What the user should do
  retry_after?: number;    // For rate limiting
}
```

## Performance Considerations

### Rate Limiting
- GitHub API: 5,000 requests/hour (authenticated)
- Strategy: Track usage, implement exponential backoff
- Optimization: Batch related API calls

### Response Time Targets
- Immediate mode: < 2 seconds
- Wait mode: Depends on CI duration (1-30 minutes typical)
- Streaming updates: For long-running operations

### Caching Strategy
- PR metadata: Cache for 30 seconds (sufficient for most workflows)
- Check runs: No caching (status changes frequently)
- Comments: Cache until operation completes

## Security Considerations

### Authentication
- Require GitHub Personal Access Token via environment variable
- Never log or expose tokens in responses
- Validate token permissions on startup

### Authorization
- Respect GitHub repository permissions
- Fail gracefully when permissions insufficient
- Never attempt to bypass GitHub security

### Input Validation
- Strict schema validation using Zod
- Sanitize all inputs before GitHub API calls
- Prevent injection attacks via command generation

## Extensibility Points

### Adding New Tools
1. Define Zod schema for input validation
2. Implement handler in Tool Handlers Layer
3. Register with MCP server
4. Add tests for edge cases
5. Document in README

### Adding GitHub API Support
1. Extend GitHub Integration Layer with new module
2. Handle new API endpoints in Octokit layer
3. Update type definitions
4. Add error handling for new failure modes

### Adding AI Provider Support
- MCP protocol is provider-agnostic
- No code changes needed for different AI agents
- Consider response format preferences per provider (future)

