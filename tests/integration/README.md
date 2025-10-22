# Integration Tests

Integration tests run against the **real GitHub API** and require:
1. A valid `GITHUB_TOKEN` environment variable
2. The `RUN_INTEGRATION_TESTS=true` flag to explicitly opt-in

## Why Opt-In?

Integration tests are **disabled by default** because they:
- Make real API calls (consume rate limit)
- Are slower than unit tests
- Require valid GitHub credentials
- May fail due to external factors (network, GitHub outages)

## Running Integration Tests

### Locally (with your GitHub token)

```bash
# Set your GitHub token
export GITHUB_TOKEN=ghp_your_token_here

# Explicitly opt-in to integration tests
export RUN_INTEGRATION_TESTS=true

# Run integration tests
npm run test:integration
```

### In CI (GitHub Actions)

Integration tests run automatically in CI using the `GITHUB_TOKEN` secret:

```yaml
- name: Run integration tests
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    RUN_INTEGRATION_TESTS: true
  run: npm run test:integration
```

## Test Structure

Integration tests mirror the unit test structure but use real API calls:

```
tests/
├── unit/                    # Fast, mocked (default)
│   └── tools/
│       ├── get-failing-tests.test.ts
│       └── ...
└── integration/             # Slow, real API (opt-in)
    └── tools/
        ├── get-failing-tests.integration.test.ts
        └── ...
```

## Safety Guards

Integration tests have multiple safety checks:
1. ✅ Require `GITHUB_TOKEN` env var
2. ✅ Require `RUN_INTEGRATION_TESTS=true` flag
3. ✅ Skip gracefully if either is missing
4. ✅ Use a dedicated test repository to avoid pollution

## Test Repository

Integration tests use: `jmalicki/resolve-pr-mcp-test-repo` (or similar)

This ensures we don't pollute real repositories with test data.

