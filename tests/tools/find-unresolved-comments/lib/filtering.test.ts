import { describe, it, expect } from "vitest";
import {
  filterUnresolvedComments,
  applyBasicFiltering,
  sortComments,
} from "../../../../src/tools/find-unresolved-comments/lib/filtering.js";
import type { Comment } from "../../../../src/tools/find-unresolved-comments/schema.js";

describe("filtering", () => {
  describe("filterUnresolvedComments", () => {
    it("should filter out comments from resolved threads", () => {
      const comments: Comment[] = [
        {
          id: 1,
          type: "review_comment",
          author: "reviewer",
          author_association: "MEMBER",
          is_bot: false,
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          file_path: "src/file.ts",
          line_number: 10,
          body: "Resolved comment",
          html_url: "https://github.com/test/repo/pull/123#discussion_r1",
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: "Only after fix is verified",
            view_in_browser: "https://github.com/test/repo/pull/123",
          },
        },
      ];

      const nodeIdMap = new Map([[1, "thread-123"]]);
      const resolvedThreadIds = new Set(["thread-123"]);

      const result = filterUnresolvedComments(
        comments,
        nodeIdMap,
        resolvedThreadIds,
      );

      expect(result).toHaveLength(0);
    });

    it("should keep unresolved comments from non-resolved threads", () => {
      const comments: Comment[] = [
        {
          id: 2,
          type: "review_comment",
          author: "reviewer",
          author_association: "MEMBER",
          is_bot: false,
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          file_path: "src/file.ts",
          line_number: 15,
          body: "Unresolved comment",
          html_url: "https://github.com/test/repo/pull/123#discussion_r2",
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: "Only after fix is verified",
            view_in_browser: "https://github.com/test/repo/pull/123",
          },
        },
      ];

      const nodeIdMap = new Map([[2, "thread-456"]]);
      const resolvedThreadIds = new Set<string>();

      const result = filterUnresolvedComments(
        comments,
        nodeIdMap,
        resolvedThreadIds,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("should filter out reply comments", () => {
      const comments: Comment[] = [
        {
          id: 3,
          type: "review_comment",
          author: "reviewer",
          author_association: "MEMBER",
          is_bot: false,
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          file_path: "src/file.ts",
          line_number: 20,
          body: "Original comment",
          html_url: "https://github.com/test/repo/pull/123#discussion_r3",
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: "Only after fix is verified",
            view_in_browser: "https://github.com/test/repo/pull/123",
          },
        },
        {
          id: 4,
          type: "review_comment",
          author: "developer",
          author_association: "CONTRIBUTOR",
          is_bot: false,
          created_at: "2024-01-01T11:00:00Z",
          updated_at: "2024-01-01T11:00:00Z",
          file_path: "src/file.ts",
          line_number: 20,
          body: "Reply to comment 3",
          in_reply_to_id: 3,
          html_url: "https://github.com/test/repo/pull/123#discussion_r4",
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: "Only after fix is verified",
            view_in_browser: "https://github.com/test/repo/pull/123",
          },
        },
      ];

      const nodeIdMap = new Map();
      const resolvedThreadIds = new Set<string>();

      const result = filterUnresolvedComments(
        comments,
        nodeIdMap,
        resolvedThreadIds,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3); // Only original comment, not reply
    });

    it("should keep issue comments even without thread resolution status", () => {
      const comments: Comment[] = [
        {
          id: 5,
          type: "issue_comment",
          author: "reviewer",
          author_association: "MEMBER",
          is_bot: false,
          created_at: "2024-01-01T12:00:00Z",
          updated_at: "2024-01-01T12:00:00Z",
          body: "Issue comment",
          html_url: "https://github.com/test/repo/issues/123#issuecomment-5",
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: "Only after fix is verified",
            view_in_browser: "https://github.com/test/repo/pull/123",
          },
        },
      ];

      const nodeIdMap = new Map();
      const resolvedThreadIds = new Set<string>();

      const result = filterUnresolvedComments(
        comments,
        nodeIdMap,
        resolvedThreadIds,
      );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("issue_comment");
    });
  });

  describe("applyBasicFiltering", () => {
    it("should filter out bot comments when include_bots is false", () => {
      const comments: Comment[] = [
        {
          id: 1,
          type: "review_comment",
          author: "coderabbitai",
          author_association: "NONE",
          is_bot: true,
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          file_path: "src/file.ts",
          line_number: 10,
          body: "Bot comment",
          html_url: "https://github.com/test/repo/pull/123#discussion_r1",
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: "Only after fix is verified",
            view_in_browser: "https://github.com/test/repo/pull/123",
          },
        },
        {
          id: 2,
          type: "review_comment",
          author: "reviewer",
          author_association: "MEMBER",
          is_bot: false,
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          file_path: "src/file.ts",
          line_number: 15,
          body: "Human comment",
          html_url: "https://github.com/test/repo/pull/123#discussion_r2",
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: "Only after fix is verified",
            view_in_browser: "https://github.com/test/repo/pull/123",
          },
        },
      ];

      const result = applyBasicFiltering(comments, false, []);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
      expect(result[0].is_bot).toBe(false);
    });

    it("should exclude specific authors", () => {
      const comments: Comment[] = [
        {
          id: 3,
          type: "review_comment",
          author: "excluded-reviewer",
          author_association: "MEMBER",
          is_bot: false,
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          file_path: "src/file.ts",
          line_number: 20,
          body: "Excluded author comment",
          html_url: "https://github.com/test/repo/pull/123#discussion_r3",
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: "Only after fix is verified",
            view_in_browser: "https://github.com/test/repo/pull/123",
          },
        },
        {
          id: 4,
          type: "review_comment",
          author: "regular-reviewer",
          author_association: "MEMBER",
          is_bot: false,
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          file_path: "src/file.ts",
          line_number: 25,
          body: "Normal comment",
          html_url: "https://github.com/test/repo/pull/123#discussion_r4",
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: "Only after fix is verified",
            view_in_browser: "https://github.com/test/repo/pull/123",
          },
        },
      ];

      const result = applyBasicFiltering(comments, true, ["excluded-reviewer"]);

      expect(result).toHaveLength(1);
      expect(result[0].author).toBe("regular-reviewer");
    });
  });

  describe("sortComments", () => {
    const createComment = (
      id: number,
      createdAt: string,
      filePath?: string,
      author?: string,
      priorityScore?: number,
    ): Comment => ({
      id,
      type: "review_comment" as const,
      author: author || "reviewer",
      author_association: "MEMBER",
      is_bot: false,
      created_at: createdAt,
      updated_at: createdAt,
      file_path: filePath,
      line_number: 10,
      body: "Comment",
      html_url: `https://github.com/test/repo/pull/123#discussion_r${id}`,
      action_commands: {
        reply_command: 'gh pr comment 123 --body "text"',
        resolve_condition: "Only after fix is verified",
        view_in_browser: "https://github.com/test/repo/pull/123",
      },
      ...(priorityScore !== undefined && {
        status_indicators: {
          priority_score: priorityScore,
          needs_mcp_resolution: false,
          has_manual_response: false,
          is_actionable: false,
          is_outdated: false,
          resolution_status: "unresolved" as const,
          suggested_action: "reply" as const,
        },
      }),
    });

    it("should sort by chronological order", () => {
      const comments: Comment[] = [
        createComment(1, "2024-01-01T15:00:00Z"),
        createComment(2, "2024-01-01T10:00:00Z"),
        createComment(3, "2024-01-01T12:00:00Z"),
      ];

      const result = sortComments(comments, "chronological", false, false);

      expect(result[0].id).toBe(2); // Oldest first
      expect(result[1].id).toBe(3);
      expect(result[2].id).toBe(1);
    });

    it("should sort by file path", () => {
      const comments: Comment[] = [
        createComment(1, "2024-01-01T10:00:00Z", "src/z.ts"),
        createComment(2, "2024-01-01T10:00:00Z", "src/a.ts"),
        createComment(3, "2024-01-01T10:00:00Z", "src/m.ts"),
      ];

      const result = sortComments(comments, "by_file", false, false);

      expect(result[0].file_path).toBe("src/a.ts");
      expect(result[1].file_path).toBe("src/m.ts");
      expect(result[2].file_path).toBe("src/z.ts");
    });

    it("should sort by author", () => {
      const comments: Comment[] = [
        createComment(1, "2024-01-01T10:00:00Z", undefined, "zeb"),
        createComment(2, "2024-01-01T10:00:00Z", undefined, "alice"),
        createComment(3, "2024-01-01T10:00:00Z", undefined, "mike"),
      ];

      const result = sortComments(comments, "by_author", false, false);

      expect(result[0].author).toBe("alice");
      expect(result[1].author).toBe("mike");
      expect(result[2].author).toBe("zeb");
    });

    it("should sort by priority when priority ordering enabled", () => {
      const comments: Comment[] = [
        createComment(1, "2024-01-01T10:00:00Z", undefined, undefined, 30),
        createComment(2, "2024-01-01T10:00:00Z", undefined, undefined, 90),
        createComment(3, "2024-01-01T10:00:00Z", undefined, undefined, 50),
      ];

      const result = sortComments(comments, "priority", true, true);

      expect(result[0].id).toBe(2); // Highest priority first (90)
      expect(result[1].id).toBe(3); // Medium priority (50)
      expect(result[2].id).toBe(1); // Lowest priority (30)
    });

    it("should fall back to chronological when priority ordering disabled", () => {
      const comments: Comment[] = [
        createComment(1, "2024-01-01T15:00:00Z"),
        createComment(2, "2024-01-01T10:00:00Z"),
        createComment(3, "2024-01-01T12:00:00Z"),
      ];

      const result = sortComments(comments, "priority", false, false);

      expect(result[0].id).toBe(2); // Falls back to chronological
      expect(result[1].id).toBe(3);
      expect(result[2].id).toBe(1);
    });
  });
});
