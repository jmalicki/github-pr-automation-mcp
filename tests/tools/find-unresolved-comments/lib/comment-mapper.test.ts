import { describe, it, expect } from "vitest";
import {
  mapReviewComments,
  mapIssueComments,
} from "../../../../src/tools/find-unresolved-comments/lib/comment-mapper.js";
import type { Comment } from "../../../../src/tools/find-unresolved-comments/schema.js";

/**
 * Unit tests for comment-mapper.ts
 *
 * These tests focus on mapping GitHub API responses to our unified Comment type.
 * Note: CodeRabbit AI parsing is tested separately in review-parser.test.ts
 */
describe("comment-mapper", () => {
  const mockPr = { owner: "test-owner", repo: "test-repo", number: 123 };

  describe("mapReviewComments - General review comment mapping", () => {
    it("should map review comments with all fields", () => {
      const mockReviewComments = [
        {
          id: 1,
          user: { login: "reviewer", type: "User" },
          author_association: "MEMBER",
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          path: "src/file.ts",
          line: 10,
          start_line: 8,
          diff_hunk: "@@ -8,5 +8,5 @@",
          body: "Please fix this issue",
          in_reply_to_id: null,
          html_url:
            "https://github.com/test-owner/test-repo/pull/123#discussion_r1",
          reactions: {
            total_count: 2,
            "+1": 2,
            "-1": 0,
            laugh: 0,
            hooray: 0,
            confused: 0,
            heart: 0,
            rocket: 0,
            eyes: 0,
          },
        },
      ];

      const nodeIdMap = new Map([[1, "thread-123"]]);

      const result = mapReviewComments(mockReviewComments, mockPr, nodeIdMap);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        type: "review_comment",
        author: "reviewer",
        author_association: "MEMBER",
        is_bot: false,
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:00:00Z",
        file_path: "src/file.ts",
        line_number: 10,
        start_line: 8,
        diff_hunk: "@@ -8,5 +8,5 @@",
        body: "Please fix this issue",
        html_url:
          "https://github.com/test-owner/test-repo/pull/123#discussion_r1",
      });
      expect(result[0].action_commands).toBeDefined();
    });

    it("should handle bot comments correctly", () => {
      const mockReviewComments = [
        {
          id: 2,
          user: { login: "coderabbitai", type: "Bot" },
          author_association: "NONE",
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          path: "src/file.ts",
          line: 15,
          body: "Bot suggestion",
          html_url:
            "https://github.com/test-owner/test-repo/pull/123#discussion_r2",
          reactions: {
            total_count: 0,
            "+1": 0,
            "-1": 0,
            laugh: 0,
            hooray: 0,
            confused: 0,
            heart: 0,
            rocket: 0,
            eyes: 0,
          },
        },
      ];

      const nodeIdMap = new Map();

      const result = mapReviewComments(mockReviewComments, mockPr, nodeIdMap);

      expect(result[0].is_bot).toBe(true);
      expect(result[0].author).toBe("coderabbitai");
    });

    it("should handle missing optional fields", () => {
      const mockReviewComments = [
        {
          id: 3,
          user: null,
          author_association: null,
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          path: null,
          line: null,
          body: null,
          html_url:
            "https://github.com/test-owner/test-repo/pull/123#discussion_r3",
          reactions: null,
        },
      ];

      const nodeIdMap = new Map();

      const result = mapReviewComments(mockReviewComments, mockPr, nodeIdMap);

      expect(result[0]).toMatchObject({
        author: "unknown",
        author_association: "NONE",
        is_bot: false,
        body: "",
      });
      // GitHub API returns null for missing optional fields, not undefined
      expect([null, undefined]).toContain(result[0].file_path);
      expect([null, undefined]).toContain(result[0].line_number);
    });

    it("should handle reply comments", () => {
      const mockReviewComments = [
        {
          id: 4,
          user: { login: "reviewer", type: "User" },
          author_association: "MEMBER",
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          path: "src/file.ts",
          line: 20,
          body: "Reply to comment",
          in_reply_to_id: 1,
          html_url:
            "https://github.com/test-owner/test-repo/pull/123#discussion_r4",
          reactions: {
            total_count: 0,
            "+1": 0,
            "-1": 0,
            laugh: 0,
            hooray: 0,
            confused: 0,
            heart: 0,
            rocket: 0,
            eyes: 0,
          },
        },
      ];

      const nodeIdMap = new Map();

      const result = mapReviewComments(mockReviewComments, mockPr, nodeIdMap);

      expect(result[0].in_reply_to_id).toBe(1);
    });
  });

  describe("mapIssueComments - General issue comment mapping", () => {
    it("should map issue comments with all fields", () => {
      const mockIssueComments = [
        {
          id: 5,
          user: { login: "commenter", type: "User" },
          author_association: "CONTRIBUTOR",
          created_at: "2024-01-01T11:00:00Z",
          updated_at: "2024-01-01T11:00:00Z",
          body: "General PR comment",
          html_url:
            "https://github.com/test-owner/test-repo/issues/123#issuecomment-5",
          reactions: {
            total_count: 1,
            "+1": 1,
            "-1": 0,
            laugh: 0,
            hooray: 0,
            confused: 0,
            heart: 0,
            rocket: 0,
            eyes: 0,
          },
        },
      ];

      const result = mapIssueComments(mockIssueComments, mockPr);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 5,
        type: "issue_comment",
        author: "commenter",
        author_association: "CONTRIBUTOR",
        is_bot: false,
        created_at: "2024-01-01T11:00:00Z",
        updated_at: "2024-01-01T11:00:00Z",
        body: "General PR comment",
        html_url:
          "https://github.com/test-owner/test-repo/issues/123#issuecomment-5",
      });
      expect(result[0].file_path).toBeUndefined();
      expect(result[0].line_number).toBeUndefined();
      expect(result[0].action_commands).toBeDefined();
    });

    it("should handle bot issue comments", () => {
      const mockIssueComments = [
        {
          id: 6,
          user: { login: "github-actions", type: "Bot" },
          author_association: "NONE",
          created_at: "2024-01-01T12:00:00Z",
          updated_at: "2024-01-01T12:00:00Z",
          body: "Automated comment",
          html_url:
            "https://github.com/test-owner/test-repo/issues/123#issuecomment-6",
          reactions: {
            total_count: 0,
            "+1": 0,
            "-1": 0,
            laugh: 0,
            hooray: 0,
            confused: 0,
            heart: 0,
            rocket: 0,
            eyes: 0,
          },
        },
      ];

      const result = mapIssueComments(mockIssueComments, mockPr);

      expect(result[0].is_bot).toBe(true);
      expect(result[0].author).toBe("github-actions");
    });

    it("should handle missing optional fields in issue comments", () => {
      const mockIssueComments = [
        {
          id: 7,
          user: null,
          author_association: null,
          created_at: "2024-01-01T13:00:00Z",
          updated_at: "2024-01-01T13:00:00Z",
          body: null,
          html_url:
            "https://github.com/test-owner/test-repo/issues/123#issuecomment-7",
          reactions: null,
        },
      ];

      const result = mapIssueComments(mockIssueComments, mockPr);

      expect(result[0]).toMatchObject({
        author: "unknown",
        author_association: "NONE",
        is_bot: false,
        body: "",
      });
    });
  });
});
