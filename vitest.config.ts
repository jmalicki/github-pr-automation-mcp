import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
        '**/*.config.ts'
      ],
      thresholds: {
        lines: 30,
        functions: 60,
        branches: 80,
        statements: 30
      }
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000
  }
});

