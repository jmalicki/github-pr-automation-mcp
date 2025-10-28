import { describe, it, expect } from "vitest";
import { integrationManager } from "./setup.js";

describe("Integration Test Setup", () => {
  it("should initialize integration test manager", () => {
    expect(integrationManager).toBeDefined();
  });

  it("should load fixtures when available", async () => {
    const fixture = await integrationManager.loadFixture("detect-merge-conflicts-basic-pr");
    expect(fixture).toBeDefined();
    expect(fixture.hasConflicts).toBe(false);
  });

  it("should return null for non-existent fixtures", async () => {
    const fixture = await integrationManager.loadFixture("non-existent-fixture");
    expect(fixture).toBeNull();
  });
});
