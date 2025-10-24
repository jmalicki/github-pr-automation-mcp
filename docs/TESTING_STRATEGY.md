# Testing Strategy

## Overview

The testing strategy is designed to ensure reliability, correctness, and maintainability of the MCP server with minimal reliance on live GitHub API calls.

## Test Categorization

### 1. Unit Tests
**Purpose**: Test individual functions and classes in isolation

**Scope**:
- Utility functions (parsers, formatters, validators)
- Log parsers for different test frameworks
- Comment categorization logic
- Command generation logic
- Data transformations

**Requirements**:
- No external dependencies
- Fast execution (<1s for entire suite)
- High coverage target: >90%
- Linked to requirements with comments (per user preference)

**Example**:
```typescript
// tests/utils/parser.test.ts

import { parsePRIdentifier } from '../../src/utils/parser';

describe('parsePRIdentifier', () => {
  // Test: Validates that PR identifier parsing handles standard format
  // Requirement: API Design - PR Identifier Parsing
  it('should parse standard format "owner/repo#123"', () => {
    const result = parsePRIdentifier('octocat/hello-world#42');
    
    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42
    });
  });
  
  // Test: Validates that PR identifier parsing handles URL format
  // Requirement: API Design - PR Identifier Parsing (multiple formats)
  it('should parse GitHub URL format', () => {
    const result = parsePRIdentifier(
      'https://github.com/octocat/hello-world/pull/42'
    );
    
    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42
    });
  });
  
  // Test: Validates error handling for invalid PR identifiers
  // Requirement: Error Handling - User Input Errors
  it('should throw error for invalid format', () => {
    expect(() => parsePRIdentifier('invalid')).toThrow();
  });
});
```

### 2. Integration Tests
**Purpose**: Test interactions between components with real GitHub API behavior using @octokit/fixtures

**Scope**:
- Tool handlers with real GitHub API responses (recorded/playback)
- Complete workflows from input to output
- Multi-step workflows
- Pagination logic
- Error propagation
- Real API behavior without network dependency

**Requirements**:
- Use @octokit/fixtures for recording/playback
- Test error scenarios with real API responses
- Validate data flow through layers
- Execution time <10s for suite (playback mode)
- Record fixtures once, play back many times

**Example**:
```typescript
// tests/integration/tools/get-failing-tests.integration.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { handleGetFailingTests } from '../../../src/tools/get-failing-tests/handler.js';
import { integrationManager } from '../setup.js';

describe('get_failing_tests integration', () => {
  const TEST_PR = process.env.TEST_PR || 'jmalicki/resolve-pr-mcp#2';

  beforeAll(async () => {
    // Load fixture for this test scenario
    const fixture = await integrationManager.loadFixture('get-failing-tests/basic-pr');
    
    if (fixture) {
      console.log('✓ Using recorded fixture for get-failing-tests');
    } else {
      console.log('✓ Recording new fixture for get-failing-tests');
    }
  });
  
  // Test: Validates that get_failing_tests returns real PR data
  // Requirement: get_failing_tests tool - Real API behavior
  it('should fetch real PR data from GitHub', async () => {
    const client = integrationManager.getClient();
    const result = await handleGetFailingTests(client, {
      pr: TEST_PR,
      wait: false,
      bail_on_first: false,
      page: 1,
      page_size: 10
    });

    // Verify we got real data back
    expect(result.pr).toContain('#');
    expect(result.status).toMatch(/passed|failed|running|unknown/);
    expect(result.nextCursor !== undefined).toBe(true);
    expect(result.instructions).toBeDefined();

    // Save fixture if in record mode
    await integrationManager.saveFixture('get-failing-tests/basic-pr', result);
  });
  
  // Test: Validates pagination with real data
  // Requirement: get_failing_tests - Pagination support
  it('should handle pagination with real data', async () => {
    const client = integrationManager.getClient();
    const page1 = await handleGetFailingTests(client, {
      pr: TEST_PR,
      wait: false,
      bail_on_first: false,
      page: 1,
      page_size: 5
    });

    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.page_size).toBe(5);

    // Save fixture if in record mode
    await integrationManager.saveFixture('get-failing-tests/pagination', page1);
  });
});
```

### 3. E2E Tests (Integrated with Integration Tests)
**Purpose**: Complete end-to-end testing with real GitHub API behavior using @octokit/fixtures

**Scope**:
- Complete workflows from input to output
- Real GitHub API interactions (recorded/playback)
- Rate limiting behavior (simulated)
- Error handling with real API errors
- All tool functionality with real API responses

**Requirements**:
- Use integration test infrastructure with @octokit/fixtures
- Record fixtures once, play back many times
- Fast execution in playback mode
- Deterministic results

**Modes**:
```typescript
// Record Mode: First time setup
export RECORD_INTEGRATION_FIXTURES=true
export RUN_INTEGRATION_TESTS=true
npm run test:integration:record

// Playback Mode: Default (fast, offline)
export RUN_INTEGRATION_TESTS=true
npm run test:integration:playback
```

**Benefits**:
- ✅ Real API behavior without network dependency
- ✅ Fast execution (no API calls in playback mode)
- ✅ Deterministic results (recorded responses)
- ✅ Rate limit friendly (no API consumption)
- ✅ Offline capability

### 4. CLI Tests
**Purpose**: Test CLI mode functionality

**Scope**:
- Command parsing and validation
- Output formatting (JSON vs. human-readable)
- Error messages and exit codes
- Shell integration

**Example**:
```typescript
// tests/cli/commands.test.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CLI get-failing-tests command', () => {
  // Test: CLI properly parses arguments
  // Requirement: CLI Mode - Argument parsing
  it('should parse command-line arguments correctly', async () => {
    const { stdout } = await execAsync(
      'node dist/cli.js get-failing-tests --pr "owner/repo#123" --json'
    );
    
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('failures');
  });
  
  // Test: CLI returns proper exit codes
  // Requirement: CLI Mode - Error handling
  it('should exit with code 1 on error', async () => {
    try {
      await execAsync('node dist/cli.js get-failing-tests --pr "invalid"');
      fail('Should have thrown');
    } catch (error) {
      expect(error.code).toBe(1);
      expect(error.stderr).toContain('Invalid PR format');
    }
  });
  
  // Test: CLI formats human-readable output
  // Requirement: CLI Mode - Output formatting
  it('should format output for human consumption', async () => {
    const { stdout } = await execAsync(
      'node dist/cli.js get-failing-tests --pr "owner/repo#123"'
    );
    
    expect(stdout).toMatch(/Status:/);
    expect(stdout).toMatch(/Failures:/);
    expect(stdout).not.toContain('{'); // Not JSON
  });
});
```

### 5. Snapshot Tests
**Purpose**: Ensure consistent output formats for AI consumption

**Scope**:
- Tool output formats
- Instruction generation
- Command generation
- Error messages

**Example**:
```typescript
// tests/snapshots/instructions.test.ts

import { generateInstructions } from '../../src/tools/get-failing-tests/instructions';

describe('instruction generation snapshots', () => {
  // Test: Ensures instruction format remains consistent for AI parsing
  // Requirement: Architecture - Token Efficiency
  it('should generate consistent instruction format', () => {
    const failures = loadFixture('sample-failures.json');
    const instructions = generateInstructions(failures);
    
    expect(instructions).toMatchSnapshot();
  });
});
```

---

## Test Fixtures

### Fixture Organization

```
tests/
├── fixtures/
│   ├── pull-requests/
│   │   ├── pr-simple.json
│   │   ├── pr-with-failures.json
│   │   ├── pr-stacked.json
│   │   └── pr-draft.json
│   ├── check-runs/
│   │   ├── check-runs-passing.json
│   │   ├── check-runs-failed.json
│   │   └── check-runs-pending.json
│   ├── logs/
│   │   ├── pytest-failures.log
│   │   ├── jest-failures.log
│   │   ├── go-test-failures.log
│   │   └── rspec-failures.log
│   ├── comments/
│   │   ├── unresolved-comments.json
│   │   ├── bot-comments.json
│   │   └── resolved-threads.json
│   └── workflows/
│       ├── workflow-run-success.json
│       └── workflow-run-failed.json
```

### Fixture Creation Guidelines

1. **Real-world Based**: Create fixtures from actual GitHub API responses
2. **Anonymized**: Remove sensitive information
3. **Comprehensive**: Cover edge cases and error scenarios
4. **Documented**: Include comments explaining the scenario

**Example Fixture**:
```json
// tests/fixtures/pull-requests/pr-with-failures.json
{
  "_comment": "PR with failing CI checks - represents common failure scenario",
  "number": 123,
  "title": "Add user authentication",
  "state": "open",
  "draft": false,
  "head": {
    "ref": "feature/auth",
    "sha": "abc123def456"
  },
  "base": {
    "ref": "main",
    "sha": "def456abc123"
  },
  "user": {
    "login": "contributor",
    "type": "User"
  },
  "mergeable": true,
  "mergeable_state": "unstable"
}
```

---

## Mock Implementations

### GitHub Client Mock

```typescript
// tests/mocks/github-client.ts

/**
 * Mock GitHub client for testing
 * Simulates GitHub API responses without network calls
 */
export class MockGitHubClient {
  private responses = new Map<string, any>();
  private callCount = new Map<string, number>();
  
  /**
   * Configure mock response for a specific endpoint
   */
  mock(endpoint: string, response: any): void {
    this.responses.set(endpoint, response);
  }
  
  /**
   * Get call count for an endpoint (for verification)
   */
  getCallCount(endpoint: string): number {
    return this.callCount.get(endpoint) || 0;
  }
  
  /**
   * Convenience method for mocking pull request
   */
  mockPullRequest(data: any): void {
    this.mock('GET /repos/:owner/:repo/pulls/:number', { data });
  }
  
  /**
   * Convenience method for mocking check runs
   */
  mockCheckRuns(data: any): void {
    this.mock('GET /repos/:owner/:repo/commits/:ref/check-runs', { data });
  }
  
  /**
   * Simulate sequential responses (for polling scenarios)
   */
  mockSequence(endpoint: string, responses: any[]): void {
    let callIndex = 0;
    this.mock(endpoint, () => {
      const response = responses[Math.min(callIndex, responses.length - 1)];
      callIndex++;
      return response;
    });
  }
  
  /**
   * Simulate rate limiting
   */
  mockRateLimit(): void {
    this.mock('*', {
      status: 403,
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600)
      }
    });
  }
}
```

### Test Utilities

```typescript
// tests/utils/helpers.ts

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await sleep(100);
  }
}

/**
 * Create a test PR identifier
 */
export function createTestPR(overrides?: Partial<PRIdentifier>): PRIdentifier {
  return {
    owner: 'test-owner',
    repo: 'test-repo',
    number: 123,
    ...overrides
  };
}

/**
 * Verify pagination metadata is correct
 */
export function expectValidPagination(
  pagination: PaginationMeta,
  expected: Partial<PaginationMeta>
): void {
  expect(pagination.page).toBeGreaterThanOrEqual(1);
  expect(pagination.page_size).toBeGreaterThanOrEqual(1);
  expect(pagination.total_pages).toBeGreaterThanOrEqual(0);
  expect(pagination.has_next).toBe(pagination.page < pagination.total_pages);
  
  if (expected) {
    expect(pagination).toMatchObject(expected);
  }
}
```

---

## Test Coverage Requirements

### Coverage Targets

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Utilities | 95% | Critical |
| Tool Handlers | 90% | Critical |
| GitHub Integration | 85% | High |
| Log Parsers | 95% | Critical |
| Error Handling | 100% | Critical |
| Command Generation | 90% | High |

### Critical Paths (100% Coverage Required)

1. **Input Validation**: All tool inputs must be validated
2. **Error Handling**: All error paths must be tested
3. **Authentication**: Token validation and permission checks
4. **Rate Limiting**: Rate limit detection and backoff logic

---

## Testing Tools

### Test Framework: Vitest

**Why Vitest**:
- Fast execution with ESM support
- Built-in TypeScript support
- Jest-compatible API
- Excellent watch mode

**Configuration**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.d.ts'
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    },
    setupFiles: ['./tests/setup.ts']
  }
});
```

### Additional Tools

- **@octokit/fixtures**: GitHub API recording/playback for integration tests
- **Zod**: Schema validation (also used in production)
- **Faker**: Generate realistic test data

---

## Test Scenarios by Tool

### get_failing_tests Scenarios

1. ✅ No CI configured
2. ✅ CI pending/queued
3. ✅ CI in progress
4. ✅ CI passed (no failures)
5. ✅ CI failed (single test)
6. ✅ CI failed (multiple tests)
7. ✅ CI failed (50+ tests, pagination)
8. ✅ Wait mode with completion
9. ✅ Wait mode with timeout
10. ✅ Bail on first failure
11. ✅ Unknown test framework
12. ✅ Malformed logs
13. ✅ Rate limiting during poll
14. ✅ PR not found
15. ✅ Invalid PR format

### find_unresolved_comments Scenarios

1. ✅ No comments
2. ✅ All comments resolved (via heuristics)
3. ✅ Mix of resolved and unresolved
4. ✅ Bot comments excluded (via exclude_authors)
5. ✅ Bot comments included (default)
6. ✅ Comments on deleted lines
7. ✅ Multi-line comment threads
8. ✅ Review vs issue comments
9. ✅ Comments with reactions
10. ✅ Pagination with 100+ comments
11. ✅ Sort by file
12. ✅ Sort by author
13. ✅ Sort chronologically
14. ✅ Thread building and analysis
15. ✅ Summary statistics generation

### manage_stacked_prs Scenarios

1. ✅ Valid stack (no changes needed)
2. ✅ Valid stack (rebase needed)
3. ✅ Invalid stack (not related)
4. ✅ PRs in different repos
5. ✅ Base PR merged
6. ✅ Dependent PR up to date
7. ✅ Potential conflicts detected
8. ✅ Command generation
9. ✅ Multi-step automation
10. ✅ Automation failure handling
11. ✅ Rollback scenario
12. ✅ Risk assessment
13. ✅ Visualization generation
14. ✅ Pagination of commands
15. ✅ Circular dependency detection

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      - run: npm run build
      
      - run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
      
      - name: Check coverage thresholds
        run: |
          if [ $(jq '.total.lines.pct < 85' coverage/coverage-summary.json) = true ]; then
            echo "Coverage below 85%"
            exit 1
          fi
```

### Pre-commit Hooks

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:integration:record": "RECORD_INTEGRATION_FIXTURES=true RUN_INTEGRATION_TESTS=true vitest run --config vitest.integration.config.ts",
    "test:integration:playback": "RUN_INTEGRATION_TESTS=true vitest run --config vitest.integration.config.ts",
    "lint": "eslint src tests",
    "type-check": "tsc --noEmit"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run lint && npm run type-check",
      "pre-push": "npm run test:unit"
    }
  }
}
```

---

## Testing Best Practices

### 1. Test Naming Convention

Format: `should [expected behavior] when [condition]`

```typescript
it('should return failures when CI has completed with errors', ...);
it('should throw error when PR identifier is invalid', ...);
it('should paginate results when total exceeds page size', ...);
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should categorize blocking comments correctly', () => {
  // Arrange
  const comment = createMockComment({
    body: 'This must be fixed before merge'
  });
  
  // Act
  const category = categorizeComment(comment);
  
  // Assert
  expect(category).toBe('blocking');
});
```

### 3. Test Data Builders

```typescript
// tests/builders/comment-builder.ts
export class CommentBuilder {
  private comment: Partial<Comment> = {};
  
  withBody(body: string): this {
    this.comment.body = body;
    return this;
  }
  
  fromBot(botName: string = 'coderabbitai'): this {
    this.comment.author = botName;
    this.comment.is_bot = true;
    return this;
  }
  
  unresolved(): this {
    this.comment.is_resolved = false;
    return this;
  }
  
  build(): Comment {
    return {
      id: 1,
      type: 'review_comment',
      author: 'user',
      is_bot: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      body: 'Default comment',
      is_resolved: false,
      ...this.comment
    } as Comment;
  }
}

// Usage
const comment = new CommentBuilder()
  .fromBot('coderabbitai')
  .withBody('Nit: add space here')
  .unresolved()
  .build();
```

### 4. Avoid Test Interdependence

Each test should be independent and not rely on state from other tests.

```typescript
// ❌ Bad: Tests depend on shared state
let sharedClient: GitHubClient;

beforeAll(() => {
  sharedClient = new GitHubClient();
});

// ✅ Good: Each test creates its own instance
beforeEach(() => {
  const client = new MockGitHubClient();
  // Use client in test
});
```

This comprehensive testing strategy ensures the MCP server is robust, reliable, and maintainable.

