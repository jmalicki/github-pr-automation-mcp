# E2E Tests with Octokit Fixtures

## Overview

End-to-end tests using recorded Octokit fixtures to provide realistic GitHub API interactions without network calls.

## Test Tagging System

### Test Categories

- **`[fast]`**: Quick tests (< 1 second) - run during development
- **`[slow]`**: Comprehensive tests (1-5 seconds) - run before commits
- **E2E Directory**: All tests in `tests/e2e/` are end-to-end tests

### Test Execution

```bash
# Run all E2E tests
npm run test:e2e

# Run only fast E2E tests (development)
npm run test:e2e:fast

# Run only slow E2E tests (comprehensive)
npm run test:e2e:slow

# Run all fast tests (unit + E2E fast)
npm run test:fast

# Run all slow tests (comprehensive)
npm run test:slow
```

## Test Structure

### Setup

- **`tests/e2e/setup.ts`**: E2E test setup with Octokit fixtures
- **`tests/e2e/*.e2e.test.ts`**: Individual E2E test suites

### Available Fixtures

- `api.github.com/paginate-issues`: Real pagination data
- `api.github.com/pulls-get`: Real PR data  
- `api.github.com/check-runs-list`: Real CI data
- `api.github.com/repos-compare-commits`: Real diff data

## Development Workflow

### Quick Development

```bash
# Run fast tests during development (seconds)
npm run test:fast
```

### Pre-commit

```bash
# Run comprehensive tests before committing
npm run test:slow
```

### CI/CD

```bash
# Run all tests with coverage
npm run test:coverage
```

## Benefits

1. **Realistic Data**: Uses actual GitHub API response structures
2. **CI-Friendly**: No external API calls or tokens required
3. **Fast**: No network calls during test execution
4. **Deterministic**: Consistent results across environments
5. **Comprehensive**: Tests complete workflows end-to-end

## Adding New E2E Tests

1. Create test file: `tests/e2e/your-tool.e2e.test.ts`
2. Import setup: `import { E2ETestSetup } from './setup.js'`
3. Add appropriate category to test name: `it('[fast] should test something', ...)` or `it('[slow] should test something', ...)`
4. Use realistic scenarios with recorded fixtures

## Example

```typescript
import { describe, it, expect } from 'vitest';
import { handleYourTool } from '../../src/tools/your-tool/handler.js';
import { E2ETestSetup } from './setup.js';

describe('your-tool E2E', () => {
  const setup = new E2ETestSetup();
  
  it('should handle realistic scenario', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleYourTool(client, {
      pr: 'owner/repo#123'
    });
    
    expect(result).toBeDefined();
  }, { tags: ['e2e', 'fast'] });
});
```
