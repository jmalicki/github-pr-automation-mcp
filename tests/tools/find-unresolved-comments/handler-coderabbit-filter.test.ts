import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";

// Module under test
import { handleFindUnresolvedComments } from "../../../src/tools/find-unresolved-comments/handler.js";

// Mock GraphQL fetcher used by handler to avoid needing real GraphQL
vi.mock(
  "../../../src/tools/find-unresolved-comments/lib/graphql-fetcher.js",
  () => ({
    fetchReviewCommentNodeIds: vi.fn(async () => ({
      nodeIdMap: new Map<number, string>(),
      resolvedThreadIds: new Set<string>(),
      graphqlFailed: false,
    })),
  }),
);

describe("find-unresolved-comments handler: CodeRabbit review parsing integration", () => {
  const testDataDir = path.join(
    __dirname,
    "lib",
    "test-data",
    "coderabbit-filter",
    "prs",
  );

  const reviewFile = path.join(testDataDir, "review-PRR_kwDOQKdW-c7J2-Rw.json");

  // Minimal GitHub client mock that provides octokit with required endpoints
  function createClientMock(reviewBody: string) {
    const octokit = {
      pulls: {
        // Only reviews are needed to exercise CodeRabbit parsing path
        listReviews: vi.fn(async () => ({
          data: [
            {
              id: 123,
              user: { login: "coderabbitai", type: "Bot" },
              body: reviewBody,
              state: "APPROVED",
              author_association: "NONE",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          headers: {},
        })),
        // Not used in this test path but required by handler
        listReviewComments: vi.fn(async () => ({ data: [], headers: {} })),
      },
      issues: {
        // Not used in this test path but required by handler
        listComments: vi.fn(async () => ({ data: [], headers: {} })),
      },
    } as any;

    const client = {
      getOctokit: () => octokit,
    } as any;

    return { client, octokit };
  }

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses CodeRabbit review at handler level and returns actionable comments", async () => {
    const reviewData = JSON.parse(await fs.readFile(reviewFile, "utf8"));
    const body: string = reviewData.data.node.body;

    const { client } = createClientMock(body);

    const result = await handleFindUnresolvedComments(client, {
      pr: "jmalicki/subagent-worktree-mcp#1",
      // ensure parsing of review bodies is enabled
      parse_review_bodies: true,
      // keep defaults for CodeRabbit options
    } as any);

    // Debug: log the result to see what we got
    console.log("Result:", JSON.stringify(result, null, 2));
    console.log("Comments length:", result.comments.length);
    console.log("Unresolved in page:", result.unresolved_in_page);

    // Expect that actionable comments parsed from the review body are surfaced
    expect(result.comments.length).toBeGreaterThan(0);

    // Sanity-check: all comments originate from review body path in this test
    // (since review/issue comments were mocked to empty)
    // Also ensures high-level code path executed successfully.
    expect(result.unresolved_in_page).toBe(result.comments.length);
  });
});
