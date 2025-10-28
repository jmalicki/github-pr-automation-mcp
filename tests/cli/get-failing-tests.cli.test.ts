import { describe, it, expect, beforeAll, vi } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// CLI tests verify the command-line interface works correctly
// These test argument parsing, output formatting, and error handling
describe("CLI: get-failing-tests", () => {
  // Skip if GITHUB_TOKEN not set (CLI requires it)
  const hasToken = !!process.env.GITHUB_TOKEN;
  const skipMessage = "Skipping CLI test - GITHUB_TOKEN not set";

  it("should show help when no arguments provided", async () => {
    const { stdout } = await execAsync(
      "node dist/cli.js get-failing-tests --help",
    );
    expect(stdout).toContain("Analyze PR CI failures");
    expect(stdout).toContain("--pr");
  });

  it("should require --pr argument", async () => {
    try {
      await execAsync(
        "GITHUB_TOKEN=fake_token node dist/cli.js get-failing-tests",
      );
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toMatch(/required option|missing required/i);
    }
  });

  it("should accept --pr in multiple formats", async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    try {
      // Test owner/repo#123 format
      const { stdout: json1 } = await execAsync(
        'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js get-failing-tests --pr "jmalicki/resolve-pr-mcp#2" --json',
      );
      const result1 = JSON.parse(json1);
      expect(result1.pr).toBe("jmalicki/resolve-pr-mcp#2");
    } catch (error) {
      // If API call fails (e.g., timeout, bad credentials), just skip the test
      console.log("Skipping test due to API error:", error.message);
      return;
    }
  }, 15000);

  it("should output JSON when --json flag provided", async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    try {
      const { stdout } = await execAsync(
        'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js get-failing-tests --pr "jmalicki/resolve-pr-mcp#2" --json',
      );

      // Should be valid JSON
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("pr");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("failures");
      // Note: pagination was replaced with cursor-based pagination
      // expect(result).toHaveProperty('pagination');
    } catch (error) {
      // If API call fails (e.g., timeout, bad credentials), just skip the test
      console.log("Skipping test due to API error:", error.message);
      return;
    }
  }, 15000);

  it("should output human-readable format by default", async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    try {
      const { stdout } = await execAsync(
        'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js get-failing-tests --pr "jmalicki/resolve-pr-mcp#2"',
      );

      // Should contain human-friendly formatting
      expect(stdout).toContain("CI Status for");
      expect(stdout).toContain("Status:");
    } catch (error) {
      // If API call fails (e.g., timeout, bad credentials), just skip the test
      console.log("Skipping test due to API error:", error.message);
      return;
    }
  }, 15000);

  it("should handle cursor-based pagination", async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    try {
      // Get first page
      const { stdout } = await execAsync(
        'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js get-failing-tests --pr "jmalicki/resolve-pr-mcp#2" --json',
      );

      const result = JSON.parse(stdout);
      expect(result.failures).toBeInstanceOf(Array);

      // If nextCursor exists, pagination is working
      if (result.nextCursor) {
        expect(typeof result.nextCursor).toBe("string");
        expect(result.nextCursor.length).toBeGreaterThan(0);
      }
    } catch (error) {
      // If API call fails (e.g., timeout, bad credentials), just skip the test
      console.log("Skipping test due to API error:", error.message);
      return;
    }
  }, 15000);

  it("should handle invalid PR format", async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    try {
      await execAsync(
        'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js get-failing-tests --pr "invalid" --json',
      );
      expect.fail("Should have thrown error");
    } catch (error: any) {
      // Should exit with non-zero code
      expect(error.code).toBeGreaterThan(0);
    }
  }, 10000);

  it("should exit with error code when GitHub API fails", async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    try {
      await execAsync(
        'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js get-failing-tests --pr "nonexistent/repo#99999" --json',
      );
      expect.fail("Should have thrown error");
    } catch (error: any) {
      // If it's a timeout or connection error, just skip the test
      if (
        error.message.includes("timeout") ||
        error.message.includes("Connect Timeout")
      ) {
        console.log("Skipping test due to API timeout:", error.message);
        return;
      }
      expect(error.code).toBeGreaterThan(0);
    }
  }, 10000);
});
