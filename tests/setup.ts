// Test setup and global configuration
import { beforeAll } from "vitest";

// Global test setup
beforeAll(() => {
  // Set up test environment
  process.env.NODE_ENV = "test";
});
