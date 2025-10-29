# Integration Tests with @octokit/fixtures

Integration tests use **@octokit/fixtures** for recording and playback of real GitHub API calls, providing fast, deterministic testing with real API behavior.

## Two Modes

### 1. Record Mode (First Time Setup)

Records real GitHub API calls to fixtures for future playback.

### 2. Playback Mode (Default)

Uses recorded fixtures for fast, offline testing.

## Why @octokit/fixtures?

- ✅ **Fast execution** (no network calls in playback mode)
- ✅ **Deterministic results** (recorded responses)
- ✅ **Real API behavior** (not mocked)
- ✅ **Offline capability** (no network dependency)
- ✅ **Rate limit friendly** (no API calls in playback mode)

## Running Integration Tests

### Record New Fixtures (First Time)

```bash
# Set your GitHub token
export GITHUB_TOKEN=ghp_your_token_here

# Record new fixtures
npm run test:integration:record
```

This will:

1. Make real GitHub API calls
2. Record responses to `tests/integration/fixtures/`
3. Save fixtures with metadata

### Playback Mode (Default)

```bash
# Use recorded fixtures (no network calls)
npm run test:integration:playback
```

This will:

1. Load recorded fixtures
2. Use @octokit/fixtures server
3. Run tests without network calls

### Legacy Mode (Real API Every Time)

```bash
# Set your GitHub token
export GITHUB_TOKEN=ghp_your_token_here

# Run with real API calls (legacy behavior)
export RUN_INTEGRATION_TESTS=true
npm run test:integration
```

## Test Structure

```
tests/
├── integration/
│   ├── fixtures/                    # Recorded API responses
│   │   ├── get-failing-tests/
│   │   │   ├── basic-pr.json
│   │   │   ├── pagination.json
│   │   │   └── status-check.json
│   │   ├── find-unresolved-comments/
│   │   └── manage-stacked-prs/
│   ├── setup.ts                     # Fixture management
│   └── tools/
│       ├── get-failing-tests.integration.test.ts
│       └── ...
└── unit/                            # Fast, mocked (default)
    └── tools/
```

## Fixture Management

### Recording New Fixtures

```bash
# Record fixtures for all tools
npm run test:integration:record

# Record fixtures for specific tool
npm run test:integration:record -- --grep "get-failing-tests"
```

### Updating Fixtures

When GitHub API responses change:

```bash
# Re-record all fixtures
npm run test:integration:record

# Re-record specific tool
npm run test:integration:record -- --grep "find-unresolved-comments"
```

### Fixture Structure

```json
{
  "_metadata": {
    "recorded_at": "2024-01-15T10:30:00Z",
    "scenario": "get-failing-tests/basic-pr",
    "version": "1.0.0"
  },
  "data": {
    "pr": "jmalicki/resolve-pr-mcp#2",
    "status": "passed",
    "failures": [],
    "instructions": { ... }
  }
}
```

## Safety Guards

Integration tests have multiple safety checks:

1. ✅ Require `GITHUB_TOKEN` env var (record mode only)
2. ✅ Require `RUN_INTEGRATION_TESTS=true` flag
3. ✅ Skip gracefully if fixtures missing
4. ✅ Use dedicated test repository to avoid pollution

## Test Repository

Integration tests use: `jmalicki/resolve-pr-mcp` (or `TEST_PR` env var)

This ensures we don't pollute real repositories with test data.

## CI Integration

### GitHub Actions

```yaml
- name: Run integration tests (playback)
  run: npm run test:integration:playback

- name: Record new fixtures (on schedule)
  if: github.event_name == 'schedule'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: npm run test:integration:record
```

### Benefits in CI

- ✅ **Faster CI runs** (no network calls)
- ✅ **More reliable** (no network timeouts)
- ✅ **Deterministic** (same results every time)
- ✅ **Rate limit friendly** (no API consumption)
