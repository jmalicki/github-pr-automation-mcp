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
- **Run in CI**: ✅ Yes

**Example**: Test PR identifier parsing with standard format, URL format, and error handling scenarios.

### 2. Integration Tests
**Purpose**: Test interactions between components with mocked external services

**Scope**:
- Tool handlers with mocked GitHub client
- GitHub integration layer with fixture data
- Multi-step workflows
- Pagination logic
- Error propagation

**Requirements**:
- Mock GitHub API responses using fixtures
- Test error scenarios
- Validate data flow through layers
- Execution time <10s for suite
- **Run in CI**: ✅ Yes

**Example**: Test CI failure detection, wait modes, pagination, and error scenarios with mocked GitHub responses.

### 3. E2E Tests (Recorded Fixtures)
**Purpose**: Test complete workflows with realistic GitHub API data using recorded fixtures

**Scope**:
- Complete workflows from input to output
- Realistic GitHub API interactions (recorded)
- Rate limiting behavior simulation
- Error handling with real API error structures
- Multi-step tool interactions
- Pagination across large datasets

**Requirements**:
- Use `@octokit/fixtures` for recorded API interactions
- Run in CI (no real API calls)
- High-fidelity test data from real GitHub scenarios
- Comprehensive coverage of tool workflows

**Setup**: Use `@octokit/fixtures` to provide realistic GitHub API responses without network calls.

**Example**: Test complete pagination workflows, CI failure analysis, and multi-step tool interactions with recorded real GitHub data.

### 4. CLI Tests
**Purpose**: Test CLI mode functionality

**Scope**:
- Command parsing and validation
- Output formatting (JSON vs. human-readable)
- Error messages and exit codes
- Shell integration

**Requirements**:
- Test CLI interface without external dependencies
- Validate argument parsing and validation
- Test output formatting for both JSON and human-readable modes
- **Run in CI**: ✅ Yes

**Example**: Test argument parsing, output formatting (JSON vs human-readable), error handling, and exit codes.

### 5. Snapshot Tests
**Purpose**: Ensure consistent output formats for AI consumption

**Scope**:
- Tool output formats
- Instruction generation
- Command generation
- Error messages

**Example**: Test instruction generation, command output, and error message formats for consistency.

---

## Test Fixtures

### Fixture Strategy

**Hybrid Approach**:
- **Unit/Integration Tests**: Hand-built mocks for focused, fast tests
- **E2E Tests**: Recorded Octokit fixtures for realistic, comprehensive scenarios

### Recording Custom Fixtures

**Purpose**: Capture real GitHub API interactions for high-fidelity E2E testing

**Process**:
1. **Record Real Interactions**: Use `@octokit/fixtures` to capture actual API calls
2. **Anonymize Data**: Remove sensitive information while preserving structure
3. **Create Scenarios**: Build comprehensive test scenarios from recorded data
4. **Version Control**: Store fixtures in repository for consistent testing

**Process**: Use `@octokit/fixtures` to record real API interactions, anonymize data, and save as version-controlled fixtures.

### Fixture Organization

```
tests/
├── fixtures/
│   ├── recorded/                    # E2E fixtures (recorded from real API)
│   │   ├── pr-19-workflow.json     # Complete PR workflow
│   │   ├── large-pr-pagination.json # Multi-page comment pagination
│   │   ├── ci-failure-scenario.json # Real CI failure data
│   │   └── merge-conflict-data.json # Real merge conflict scenario
│   ├── unit/                       # Unit test fixtures (hand-built)
│   │   ├── pull-requests/
│   │   │   ├── pr-simple.json
│   │   │   ├── pr-with-failures.json
│   │   │   ├── pr-stacked.json
│   │   │   └── pr-draft.json
│   │   ├── check-runs/
│   │   │   ├── check-runs-passing.json
│   │   │   ├── check-runs-failed.json
│   │   │   └── check-runs-pending.json
│   │   ├── logs/
│   │   │   ├── pytest-failures.log
│   │   │   ├── jest-failures.log
│   │   │   ├── go-test-failures.log
│   │   │   └── rspec-failures.log
│   │   ├── comments/
│   │   │   ├── unresolved-comments.json
│   │   │   ├── bot-comments.json
│   │   │   └── resolved-threads.json
│   │   └── workflows/
│   │       ├── workflow-run-success.json
│   │       └── workflow-run-failed.json
│   └── custom-scenarios/           # Custom Octokit fixtures
│       └── pr-data.json           # Custom PR scenario
```

### Fixture Creation Guidelines

1. **Real-world Based**: Create fixtures from actual GitHub API responses
2. **Anonymized**: Remove sensitive information
3. **Comprehensive**: Cover edge cases and error scenarios
4. **Documented**: Include comments explaining the scenario

**Guidelines**: Create fixtures from real GitHub API responses, anonymize sensitive data, document scenarios, and maintain comprehensive coverage of edge cases.

---

## Mock Implementations

**GitHub Client Mock**: Simulate API responses without network calls, support sequential responses for polling, and include rate limiting simulation.

**Test Utilities**: Helper functions for waiting, test data creation, and pagination validation.

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

**Configuration**: Use Vitest with v8 coverage provider, exclude test files and node_modules, set coverage thresholds, and include setup files.

### Additional Tools

- **Zod**: Schema validation (also used in production)
- **Nock**: HTTP mocking (for E2E tests if needed)
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
      
      # Run all test suites (unit, integration, E2E)
      - name: Run tests with coverage
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

**Test Execution Strategy**:
- **Unit Tests**: Fast, focused, high coverage
- **Integration Tests**: Component interactions with mocks
- **E2E Tests**: Complete workflows with recorded fixtures (no real API calls)
- **All tests run in CI**: No external dependencies or API tokens required

### Benefits of Recorded E2E Testing

**Why This Approach Works**:

1. **Realistic Data**: Recorded fixtures contain actual GitHub API response structures, ensuring tests match real-world scenarios
2. **CI-Friendly**: No external API calls or tokens required - tests run reliably in CI
3. **Comprehensive Coverage**: E2E tests prove complete workflows work end-to-end
4. **Maintainable**: Fixtures are version-controlled and don't require live API access
5. **Fast**: No network calls during test execution
6. **Deterministic**: Consistent results across environments

**Example Scenarios Covered**:
- **Complete PR workflows** with real comment pagination
- **CI failure analysis** with actual test output structures  
- **Multi-step tool interactions** with realistic data flow
- **Edge cases** captured from real GitHub scenarios

### Pre-commit Hooks

**Setup**: Configure husky hooks for pre-commit linting/type-checking and pre-push test execution.

---

## Testing Best Practices

### 1. Test Naming Convention

Format: `should [expected behavior] when [condition]`

### 2. Arrange-Act-Assert Pattern

Structure tests with clear setup, execution, and verification phases.

### 3. Test Data Builders

Use builder pattern for creating complex test data with fluent interface.

### 4. Avoid Test Interdependence

Each test should be independent and not rely on state from other tests.

This comprehensive testing strategy ensures the MCP server is robust, reliable, and maintainable.

