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
        '**/*.config.ts',
        'src/cli.ts',     // CLI tested via CLI tests
        'src/index.ts',   // MCP server entry point tested via integration
        'scripts/**',     // Build scripts
        'src/github/errors.ts',    // Error handling tested via integration
        'src/utils/validation.ts'  // Zod schemas tested via tool usage
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

