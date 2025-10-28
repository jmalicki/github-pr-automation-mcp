import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GitHubClient } from "../../src/github/client.js";
import { handleCheckMergeReadiness } from "../../src/tools/check-merge-readiness/handler.js";

describe("handleCheckMergeReadiness", () => {
  let mockClient: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      pulls: {
        get: vi.fn(),
      },
      checks: {
        listForRef: vi.fn(),
      },
    };

    mockClient = {
      getOctokit: vi.fn().mockReturnValue(mockOctokit),
    } as any;
  });

  it("should return ready to merge when all checks pass", async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: "abc123" },
        mergeable: true,
        mergeable_state: "clean",
      },
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            status: "completed",
            conclusion: "success",
          },
        ],
      },
    });

    const result = await handleCheckMergeReadiness(mockClient, {
      pr: "owner/repo#123",
    });

    expect(result.pr).toBe("owner/repo#123");
    expect(result.ready_to_merge).toBe(true);
    expect(result.checks.ci_passing).toBe(true);
    expect(result.checks.no_conflicts).toBe(true);
    expect(result.blocking_issues).toHaveLength(0);

    // Verify API calls - handler intentionally calls pulls.get twice:
    // 1. Initial PR fetch to get basic details
    // 2. Re-check after potential state changes to ensure accuracy
    expect(mockOctokit.pulls.get).toHaveBeenCalledTimes(2);
  });

  it("should detect CI failures", async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: "abc123" },
        mergeable: true,
        mergeable_state: "clean",
      },
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            status: "completed",
            conclusion: "failure",
          },
        ],
      },
    });

    const result = await handleCheckMergeReadiness(mockClient, {
      pr: "owner/repo#123",
    });

    expect(result.ready_to_merge).toBe(false);
    expect(result.checks.ci_passing).toBe(false);
    expect(result.blocking_issues).toHaveLength(1);
    expect(result.blocking_issues[0].category).toBe("ci");
    expect(result.blocking_issues[0].description).toBe("CI checks are failing");
  });

  it("should detect merge conflicts", async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: "abc123" },
        mergeable: false,
        mergeable_state: "dirty",
      },
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [],
      },
    });

    const result = await handleCheckMergeReadiness(mockClient, {
      pr: "owner/repo#123",
    });

    expect(result.ready_to_merge).toBe(false);
    expect(result.checks.no_conflicts).toBe(false);
    expect(result.blocking_issues).toHaveLength(1);
    expect(result.blocking_issues[0].category).toBe("conflicts");
    expect(result.blocking_issues[0].description).toBe(
      "PR has merge conflicts",
    );
  });

  it("should handle multiple blocking issues", async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: "abc123" },
        mergeable: false,
        mergeable_state: "dirty",
      },
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            status: "completed",
            conclusion: "failure",
          },
        ],
      },
    });

    const result = await handleCheckMergeReadiness(mockClient, {
      pr: "owner/repo#123",
    });

    expect(result.ready_to_merge).toBe(false);
    expect(result.blocking_issues).toHaveLength(2);
    expect(
      result.blocking_issues.some((issue) => issue.category === "ci"),
    ).toBe(true);
    expect(
      result.blocking_issues.some((issue) => issue.category === "conflicts"),
    ).toBe(true);
  });

  it("should handle no check runs as passing", async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: "abc123" },
        mergeable: true,
        mergeable_state: "clean",
      },
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [],
      },
    });

    const result = await handleCheckMergeReadiness(mockClient, {
      pr: "owner/repo#123",
    });

    expect(result.checks.ci_passing).toBe(true);
    expect(result.ready_to_merge).toBe(true);
  });

  it("should handle pending check runs", async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: "abc123" },
        mergeable: true,
        mergeable_state: "clean",
      },
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            status: "in_progress",
            conclusion: null,
          },
        ],
      },
    });

    const result = await handleCheckMergeReadiness(mockClient, {
      pr: "owner/repo#123",
    });

    expect(result.checks.ci_passing).toBe(false);
    expect(result.blocking_issues).toHaveLength(1);
  });
});
