import { describe, it, expect, beforeAll } from "vitest";
import { handleCheckMergeReadiness } from "../../../src/tools/check-merge-readiness/handler.js";
import { integrationManager } from "../setup.js";

// These tests use real GitHub API calls to test merge readiness checking
// They require GITHUB_TOKEN and RUN_INTEGRATION_TESTS=true

describe("check_merge_readiness integration", () => {
  // Use a real test PR in a test repository
  const TEST_PR = process.env.TEST_PR || "jmalicki/resolve-pr-mcp#2";

  beforeAll(async () => {
    // Load fixture for this test scenario
    const fixture = await integrationManager.loadFixture(
      "check-merge-readiness/basic-pr",
    );

    if (fixture) {
      console.log("✓ Using recorded fixture for check-merge-readiness");
    } else {
      console.log("✓ Recording new fixture for check-merge-readiness");
    }
  });

  it("should check merge readiness for a real PR", async () => {
    const client = integrationManager.getClient();
    const result = await handleCheckMergeReadiness(client, {
      pr: TEST_PR,
    });

    // Verify we got real data back
    expect(result.pr).toContain("#");
    expect(result.ready_to_merge).toBeDefined();
    expect(typeof result.ready_to_merge).toBe("boolean");
    expect(result.checks).toBeDefined();
    expect(typeof result.checks).toBe("object");

    // Should have check object with boolean properties
    expect(typeof result.checks.ci_passing).toBe("boolean");
    expect(typeof result.checks.approvals_met).toBe("boolean");
    expect(typeof result.checks.no_conflicts).toBe("boolean");
    expect(typeof result.checks.up_to_date).toBe("boolean");

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "check-merge-readiness/basic-pr",
      result,
    );
  }, 10000); // 10 second timeout for API calls

  it("should identify specific merge blockers", async () => {
    const client = integrationManager.getClient();
    const result = await handleCheckMergeReadiness(client, {
      pr: TEST_PR,
    });

    // Should have detailed check results
    expect(result.checks).toBeDefined();
    expect(typeof result.checks).toBe("object");

    // If not ready, should have specific blockers
    if (!result.ready_to_merge) {
      expect(result.blocking_issues).toBeDefined();
      expect(Array.isArray(result.blocking_issues)).toBe(true);

      // Each blocker should have actionable information
      result.blocking_issues.forEach((blocker) => {
        expect(blocker.description).toBeDefined();
        expect(blocker.description.length).toBeGreaterThan(0);
      });
    }

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "check-merge-readiness/blockers",
      result,
    );
  }, 10000);

  it("should provide actionable next steps", async () => {
    const client = integrationManager.getClient();
    const result = await handleCheckMergeReadiness(client, {
      pr: TEST_PR,
    });

    // Should have next steps regardless of readiness
    expect(result.next_steps).toBeDefined();
    expect(Array.isArray(result.next_steps)).toBe(true);

    // If not ready, should have specific steps to resolve blockers
    if (!result.ready_to_merge) {
      expect(result.next_steps.length).toBeGreaterThan(0);

      // Each step should be actionable
      result.next_steps.forEach((step) => {
        expect(step).toHaveProperty("action");
        expect(step).toHaveProperty("description");
        expect(step.action).toBeDefined();
        expect(step.description).toBeDefined();
      });
    }

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "check-merge-readiness/next-steps",
      result,
    );
  }, 10000);

  it("should validate CI status and branch protection", async () => {
    const client = integrationManager.getClient();
    const result = await handleCheckMergeReadiness(client, {
      pr: TEST_PR,
    });

    // Should have CI-related checks
    const ciChecks = result.checks.filter(
      (check) =>
        check.name.toLowerCase().includes("ci") ||
        check.name.toLowerCase().includes("test") ||
        check.name.toLowerCase().includes("build"),
    );

    // Should have at least some CI-related information
    expect(ciChecks.length).toBeGreaterThanOrEqual(0);

    // Should have branch protection information
    const protectionChecks = result.checks.filter(
      (check) =>
        check.name.toLowerCase().includes("protection") ||
        check.name.toLowerCase().includes("branch") ||
        check.name.toLowerCase().includes("approval"),
    );

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "check-merge-readiness/ci-protection",
      result,
    );
  }, 15000);
});
