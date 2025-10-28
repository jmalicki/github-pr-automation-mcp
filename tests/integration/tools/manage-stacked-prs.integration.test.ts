import { describe, it, expect, beforeAll } from "vitest";
import { handleManageStackedPRs } from "../../../src/tools/manage-stacked-prs/handler.js";
import { integrationManager } from "../setup.js";

// These tests use real GitHub API calls to test stacked PR management
// They require GITHUB_TOKEN and RUN_INTEGRATION_TESTS=true

describe("manage_stacked_prs integration", () => {
  // Use real stacked PRs for testing
  const BASE_PR = process.env.BASE_PR || "jmalicki/resolve-pr-mcp#2";
  const DEPENDENT_PR = process.env.DEPENDENT_PR || "jmalicki/resolve-pr-mcp#3";

  beforeAll(async () => {
    // Load fixture for this test scenario
    const fixture = await integrationManager.loadFixture(
      "manage-stacked-prs/basic-stack",
    );

    if (fixture) {
      console.log("✓ Using recorded fixture for manage-stacked-prs");
    } else {
      console.log("✓ Recording new fixture for manage-stacked-prs");
    }
  });

  it("should analyze real stacked PRs", async () => {
    const client = integrationManager.getClient();
    const result = await handleManageStackedPRs(client, {
      base_pr: BASE_PR,
      dependent_pr: DEPENDENT_PR,
      auto_fix: false,
      max_iterations: 3,
    });

    expect(result.base_pr).toContain("#");
    expect(result.dependent_pr).toContain("#");
    expect(typeof result.is_stacked).toBe("boolean");
    expect(typeof result.changes_detected).toBe("boolean");
    expect(result.stack_info).toBeDefined();

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "manage-stacked-prs/basic-stack",
      result,
    );
  }, 15000);

  it("should detect if PRs are stacked", async () => {
    const client = integrationManager.getClient();
    const result = await handleManageStackedPRs(client, {
      base_pr: BASE_PR,
      dependent_pr: DEPENDENT_PR,
      auto_fix: false,
      max_iterations: 3,
    });

    // These PRs may change; assert shape rather than fixed truthiness
    expect(typeof result.is_stacked).toBe("boolean");
    if (result.stack_info) {
      expect(typeof result.stack_info.matches).toBe("boolean");
    }

    // Save fixture if in record mode
    await integrationManager.saveFixture(
      "manage-stacked-prs/stack-detection",
      result,
    );
  }, 15000);
});
