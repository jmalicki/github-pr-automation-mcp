import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/types/',
        '**/*.config.ts',
        'scripts/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65,
        statements: 80
      }
    },
    setupFiles: ['./tests/integration/setup.ts'],
    testTimeout: 30000
  }
});