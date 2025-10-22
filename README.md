# Resolve PR MCP Server

An MCP (Model Context Protocol) server that provides AI-assisted tools for managing GitHub Pull Requests, including automated test failure analysis, comment resolution, and stacked PR management.

## Features

### Core Tools

1. **`get_failing_tests`** - Analyze PR CI failures and get targeted fix instructions
   - Fetches failing test information from PR checks
   - Options to wait for CI completion or return immediately
   - Can bail on first failure for faster feedback
   - Pagination support for large test suites
   - Returns actionable fix instructions

2. **`find_unresolved_comments`** - Find and manage unresolved PR comments
   - Identifies unresolved review comments and conversations
   - Optional filtering for bot comments (e.g., @coderabbitai)
   - Generates response commands for efficient resolution
   - Summarizes comments requiring human judgment
   - Pagination with configurable page size

3. **`manage_stacked_prs`** - Automated stacked PR management
   - Verifies dependency chains between PRs
   - Detects when base PR changes need to be propagated
   - Generates rebase instructions and automation commands
   - Integrates with `get_failing_tests` for automated fix loops
   - Batch command generation with pagination

### Additional Tools

4. **`detect_merge_conflicts`** - Proactive conflict detection
   - Checks for merge conflicts before attempting merge
   - Provides file-level conflict details
   - Suggests conflict resolution strategies

5. **`check_merge_readiness`** - Comprehensive PR health check
   - Validates all merge requirements
   - Checks CI status, approvals, branch protection rules
   - Reports missing requirements with actionable steps

6. **`analyze_pr_impact`** - Code change impact analysis
   - Analyzes files changed, additions/deletions
   - Identifies modified components and potential impact areas
   - Suggests relevant reviewers based on file ownership

7. **`get_review_suggestions`** - AI-ready review context
   - Generates structured review context for AI agents
   - Includes diff excerpts, file summaries, and review checklist
   - Optimized for efficient token usage

8. **`rebase_after_squash_merge`** - Clean rebase after upstream squash-merge
   - Handles scenario where upstream PR was squash-merged
   - Uses `git rebase --onto` to skip upstream commits
   - Only rebases YOUR commits, avoiding conflicts
   - Auto-detects which commits to skip vs. rebase

## Installation

```bash
npm install
npm run build
```

## How It Works

This is an **MCP (Model Context Protocol) server** that runs via **stdio** (not HTTP):

- ✅ **No HTTP server** - communicates via stdin/stdout
- ✅ **No daemon** - spawned on-demand by MCP client
- ✅ **No ports** - no network exposure
- ✅ **Secure** - isolated subprocess

The MCP client (like Claude Desktop) spawns this as a subprocess and communicates via JSON-RPC over stdio.

## Configuration

Set the following environment variable:

```bash
export GITHUB_TOKEN="your_github_personal_access_token"
```

The token needs the following scopes:
- `repo` (full control of private repositories)
- `read:org` (read organization membership)

## Usage

### MCP Mode (Primary)

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "resolve-pr": {
      "command": "node",
      "args": ["/path/to/resolve-pr-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token"
      }
    }
  }
}
```

### CLI Mode (Testing & Direct Usage)

You can also use the tools directly from the command line:

```bash
# Get failing tests
resolve-pr-mcp get-failing-tests --pr "owner/repo#123" --wait --bail-on-first

# Find unresolved comments
resolve-pr-mcp find-unresolved-comments --pr "owner/repo#456" --page 1

# Manage stacked PRs
resolve-pr-mcp manage-stacked-prs --base-pr "owner/repo#100" --dependent-pr "owner/repo#101"

# Rebase after upstream squash-merge (uses --onto to skip upstream commits)
resolve-pr-mcp rebase-after-squash-merge --pr "owner/repo#101" --upstream-pr "owner/repo#100"

# Check merge readiness
resolve-pr-mcp check-merge-readiness --pr "owner/repo#789"

# Output as JSON
resolve-pr-mcp get-failing-tests --pr "owner/repo#123" --json
```

CLI mode is perfect for:
- Testing during development
- Shell scripts and automation
- CI/CD integration
- Quick checks without an MCP client

## Tool Reference

### get_failing_tests

```typescript
{
  pr: "owner/repo#123",           // PR identifier
  wait: false,                     // Wait for CI completion (default: false)
  bail_on_first: true,            // 💾 Stop at first failure (default: true)
  page: 1,                         // Page number (default: 1)
  page_size: 10                    // 💾 Results per page (default: 10)
}

// 💾 = User preference hint - AI agents may learn and remember your preference
```

### find_unresolved_comments

```typescript
{
  pr: "owner/repo#123",           // PR identifier
  include_bots: true,             // 💾 Include bot comments (default: true)
  page: 1,                         // Page number (default: 1)
  page_size: 20,                   // 💾 Results per page (default: 20)
  sort: "chronological"            // 💾 Sort order (default: chronological)
}
```

### manage_stacked_prs

```typescript
{
  base_pr: "owner/repo#123",      // Earlier PR in stack
  dependent_pr: "owner/repo#124", // Later PR in stack
  auto_fix: true,                  // Auto-fix test failures (default: true)
  page: 1,                         // Page number (default: 1)
  page_size: 5                     // Commands per page (default: 5)
}
```

## Development

```bash
# Watch mode for development
npm run watch

# Build for production
npm run build

# Test MCP server (stdio mode)
npm run dev

# Test CLI mode
npm run cli -- get-failing-tests --pr "owner/repo#123"
```

## Architecture

The server is built using:
- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **@octokit/rest** - GitHub API client
- **Zod** - Runtime type validation for tool inputs

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs) directory:

- **[Documentation Index](./docs/INDEX.md)** - Complete documentation overview
- **[Design Decisions](./docs/DESIGN_DECISIONS.md)** - Rationale for key design choices
- **[Architecture](./docs/ARCHITECTURE.md)** - System architecture and design
- **[API Design](./docs/API_DESIGN.md)** - Complete API specifications
- **[Data Models](./docs/DATA_MODELS.md)** - TypeScript type definitions
- **[Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)** - Development roadmap
- **[GitHub Integration](./docs/GITHUB_INTEGRATION.md)** - GitHub API patterns
- **[Testing Strategy](./docs/TESTING_STRATEGY.md)** - Testing approach
- **[Usage Examples](./docs/USAGE_EXAMPLES.md)** - Real-world workflows

### Quick Links

- **New to the project?** Start with the [Documentation Index](./docs/INDEX.md)
- **Want to implement?** See [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)
- **Need examples?** Check [Usage Examples](./docs/USAGE_EXAMPLES.md)
- **Understanding design?** Read [Design Decisions](./docs/DESIGN_DECISIONS.md)

## License

MIT

