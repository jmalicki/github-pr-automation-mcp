import { describe, it, expect, beforeAll } from "vitest";
import { handleGetFailingTests } from "../../../src/tools/get-failing-tests/handler.js";
import { integrationManager } from "../setup.js";

// These tests use @octokit/fixtures for recording/playback
// They support two modes:
// 1. RECORD mode: Records real GitHub API calls to fixtures
// 2. PLAYBACK mode: Uses recorded fixtures (default)

describe("get_failing_tests integration", () => {
  // Use a real test PR in a test repository
  const TEST_PR = process.env.TEST_PR || "jmalicki/resolve-pr-mcp#2";

  beforeAll(async () => {
    // Load fixture for this test scenario
    const fixture = await integrationManager.loadFixture(
      "get-failing-tests/basic-pr",
    );

    if (fixture) {
      console.log("✓ Using recorded fixture for get-failing-tests");
    } else {
      console.log("✓ Recording new fixture for get-failing-tests");
    }
  });

  it("should fetch real PR data from GitHub", async () => {
    const client = integrationManager.getClient();
    const result = await handleGetFailingTests(client, {
      pr: TEST_PR,
      wait: false,
      bail_on_first: false,
      page: 1,
      page_size: 10,
    });

    // Verify we got real data back
    expect(result.pr).toContain("#");
    expect(result.status).toMatch(/passed|failed|running|unknown/);
    expect(result.nextCursor !== undefined).toBe(true);
    expect(result.instructions).toBeDefined();

    // Save fixture if in record mode
    await integrationManager.saveFixture("get-failing-tests/basic-pr", result);
  }, 10000); // 10 second timeout for API calls

  it("should handle pagination with real data", async () => {
    const client = integrationManager.getClient();
    const page1 = await handleGetFailingTests(client, {
      pr: TEST_PR,
      wait: false,
      bail_on_first: false,
      cursor: undefined,
    });

    expect(page1.nextCursor).toBeDefined();
    expect(
      typeof page1.nextCursor === "string" || page1.nextCursor === null,
    ).toBe(true);

    // Save fixture if in record mode
    await integrationManager.saveFixture("get-failing-tests/pagination", page1);
  }, 10000);

  it("should correctly identify PR status", async () => {
    const client = integrationManager.getClient();
    const result = await handleGetFailingTests(client, {
      pr: TEST_PR,
      wait: false,
      bail_on_first: false,
      page: 1,
      page_size: 10,
    });

    // Status should be one of the valid states
    expect(["passed", "failed", "running", "unknown"]).toContain(result.status);

    // If failed, should have failures
    if (result.status === "failed") {
      expect(result.failures.length).toBeGreaterThan(0);
    }

    // If passed, should not have failures
    if (result.status === "passed") {
      expect(result.failures).toHaveLength(0);
    }

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "get-failing-tests/status-check",
      result,
    );
  }, 15000);
});
