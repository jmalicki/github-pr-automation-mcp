// Test setup and global configuration
import { beforeAll, afterAll } from "vitest";
import nock from "nock";

// Global test setup
beforeAll(() => {
  // Set up test environment
  process.env.NODE_ENV = "test";
  
  // Block all network calls for unit tests
  // This ensures tests don't accidentally make real API calls
  console.log("🔒 Network calls blocked for unit tests");
  nock.disableNetConnect();
  
  // Allow localhost connections for test servers if needed
  nock.enableNetConnect('127.0.0.1');
  nock.enableNetConnect('localhost');
});

afterAll(() => {
  // Clean up network blocking
  nock.enableNetConnect();
  nock.cleanAll();
});