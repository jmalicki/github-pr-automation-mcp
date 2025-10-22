import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    setupFiles: ['./tests/integration/setup.ts'],
    testTimeout: 30000, // 30 seconds for API calls
    hookTimeout: 10000,
    // No coverage for integration tests
    coverage: {
      enabled: false
    }
  }
});

