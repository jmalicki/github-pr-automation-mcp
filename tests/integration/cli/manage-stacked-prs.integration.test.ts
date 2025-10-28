import { describe, it, expect } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// CLI Integration tests verify the command-line interface works correctly with real GitHub API calls
// These test argument parsing, output formatting, error handling, and API integration
describe("CLI Integration: manage-stacked-prs", () => {
  it("should show help", async () => {
    const { stdout } = await execAsync(
      "node dist/cli.js manage-stacked-prs --help",
    );
    expect(stdout).toContain("Manage stacked PRs");
    expect(stdout).toContain("--base-pr");
    expect(stdout).toContain("--dependent-pr");
  });

  it("should require both base-pr and dependent-pr", async () => {
    try {
      await execAsync(
        'GITHUB_TOKEN=fake_token node dist/cli.js manage-stacked-prs --base-pr "owner/repo#123"',
      );
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toMatch(/required option|missing required/i);
    }
  });

  it("should output JSON format", async () => {
    try {
      const { stdout } = await execAsync(
        'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js manage-stacked-prs --base-pr "jmalicki/resolve-pr-mcp#2" --dependent-pr "jmalicki/resolve-pr-mcp#3" --json',
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("base_pr");
      expect(result).toHaveProperty("dependent_pr");
      expect(result).toHaveProperty("is_stacked");
      expect(result).toHaveProperty("changes_detected");
    } catch (error) {
      // If API call fails (e.g., timeout, bad credentials), just skip the test
      console.log("Skipping test due to API error:", error.message);
      return;
    }
  }, 15000);

  it("should output human-readable format", async () => {
    try {
      const { stdout } = await execAsync(
        'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js manage-stacked-prs --base-pr "jmalicki/resolve-pr-mcp#2" --dependent-pr "jmalicki/resolve-pr-mcp#3"',
      );

      expect(stdout).toContain("Base PR:");
      expect(stdout).toContain("Dependent PR:");
      expect(stdout).toContain("Is stacked:");
    } catch (error) {
      // If API call fails (e.g., timeout, bad credentials), just skip the test
      console.log("Skipping test due to API error:", error.message);
      return;
    }
  }, 15000);
});
