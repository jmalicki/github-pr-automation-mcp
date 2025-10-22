import { beforeAll } from 'vitest';

// Integration test setup
beforeAll(() => {
  // Verify required environment variables
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      'Integration tests require GITHUB_TOKEN environment variable.\n' +
      'Set it with: export GITHUB_TOKEN=ghp_your_token_here'
    );
  }

  if (process.env.RUN_INTEGRATION_TESTS !== 'true') {
    throw new Error(
      'Integration tests require explicit opt-in.\n' +
      'Set RUN_INTEGRATION_TESTS=true to run integration tests.\n' +
      'These tests make real GitHub API calls and are slower.'
    );
  }

  console.log('✓ Integration tests enabled');
  console.log('✓ Using real GitHub API');
  console.log('✓ Token:', process.env.GITHUB_TOKEN?.substring(0, 10) + '...');
});

