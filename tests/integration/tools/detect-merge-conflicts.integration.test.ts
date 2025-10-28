import { describe, it, expect, beforeAll } from "vitest";
import { handleDetectMergeConflicts } from "../../../src/tools/detect-merge-conflicts/handler.js";
import { integrationManager } from "../setup.js";

// These tests use real GitHub API calls to test merge conflict detection
// They require GITHUB_TOKEN and RUN_INTEGRATION_TESTS=true

describe("detect_merge_conflicts integration", () => {
  // Use a real test PR in a test repository
  const TEST_PR = process.env.TEST_PR || "jmalicki/resolve-pr-mcp#2";

  beforeAll(async () => {
    // Load fixture for this test scenario
    const fixture = await integrationManager.loadFixture(
      "detect-merge-conflicts/basic-pr",
    );

    if (fixture) {
      console.log("✓ Using recorded fixture for detect-merge-conflicts");
    } else {
      console.log("✓ Recording new fixture for detect-merge-conflicts");
    }
  });

  it("should detect merge conflicts in a real PR", async () => {
    const client = integrationManager.getClient();
    const result = await handleDetectMergeConflicts(client, {
      pr: TEST_PR,
    });

    // Verify we got real data back
    expect(result.pr).toContain("#");
    expect(result.has_conflicts).toBeDefined();
    expect(typeof result.has_conflicts).toBe("boolean");
    expect(result.mergeable_state).toBeDefined();
    expect(typeof result.mergeable_state).toBe("string");
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe("string");

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "detect-merge-conflicts/basic-pr",
      result,
    );
  }, 10000); // 10 second timeout for API calls

  it("should detect conflicts against specific target branch", async () => {
    const client = integrationManager.getClient();
    const result = await handleDetectMergeConflicts(client, {
      pr: TEST_PR,
      target_branch: "main",
    });

    // Verify we got real data back
    expect(result.pr).toContain("#");
    expect(result.has_conflicts).toBeDefined();
    expect(typeof result.has_conflicts).toBe("boolean");
    expect(result.target_branch).toBe("main");

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "detect-merge-conflicts/target-branch",
      result,
    );
  }, 10000);

  it("should provide actionable conflict resolution guidance", async () => {
    const client = integrationManager.getClient();
    const result = await handleDetectMergeConflicts(client, {
      pr: TEST_PR,
    });

    // Should have message regardless of conflict status
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);

    // If conflicts exist, message should be more specific
    if (result.has_conflicts) {
      expect(result.message).toMatch(/conflict|merge|resolve/i);
    }

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "detect-merge-conflicts/guidance",
      result,
    );
  }, 10000);
});
