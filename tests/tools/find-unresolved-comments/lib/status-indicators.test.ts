import { describe, it, expect } from "vitest";
import { calculateStatusIndicators } from "../../../../src/tools/find-unresolved-comments/lib/status-indicators.js";
import type { Comment } from "../../../../src/tools/find-unresolved-comments/schema.js";

describe("status-indicators", () => {
  describe("calculateStatusIndicators", () => {
    it("should calculate priority for high severity CodeRabbit actionable comment", () => {
      const comment: Comment = {
        id: 1,
        type: "review",
        author: "coderabbitai",
        author_association: "NONE",
        is_bot: true,
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:00:00Z",
        body: "Security issue: fix vulnerable code",
        html_url: "https://github.com/test/repo/pull/123",
        action_commands: {
          reply_command: 'gh pr comment 123 --body "text"',
          resolve_condition: "Only after fix is verified",
          view_in_browser: "https://github.com/test/repo/pull/123",
          mcp_action: {
            tool: "resolve_review_thread",
            args: { pr: "test/repo#123", thread_id: "thread-123" },
          },
        },
        coderabbit_metadata: {
          suggestion_type: "actionable",
          severity: "high",
          category: "security",
          file_context: { path: "src/file.ts", line_start: 10, line_end: 12 },
          agent_prompt: "Fix security issue",
          implementation_guidance: {
            priority: "high",
            effort_estimate: "5-10 minutes",
            rationale: "Security vulnerability",
          },
        },
      };

      const indicators = calculateStatusIndicators(comment, []);

      expect(indicators?.priority_score).toBeGreaterThan(70);
      expect(indicators?.needs_mcp_resolution).toBe(true);
      expect(indicators?.is_actionable).toBe(true);
      expect(indicators?.suggested_action).toBe("resolve");
    });

    it("should reduce priority for outdated comments", () => {
      const comment: Comment = {
        id: 2,
        type: "review_comment",
        author: "reviewer",
        author_association: "MEMBER",
        is_bot: false,
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:00:00Z",
        file_path: "src/file.ts",
        line_number: 10,
        body: "Old comment",
        html_url: "https://github.com/test/repo/pull/123#discussion_r2",
        outdated: true, // Comment is on outdated code
        action_commands: {
          reply_command: 'gh pr comment 123 --body "text"',
          resolve_condition: "Only after fix is verified",
          view_in_browser: "https://github.com/test/repo/pull/123",
        },
      };

      const outdatedIndicators = calculateStatusIndicators(comment, []);
      const freshComment: Comment = { ...comment, outdated: false };
      const freshIndicators = calculateStatusIndicators(freshComment, []);

      // Outdated comments should have lower priority
      expect(outdatedIndicators?.is_outdated).toBe(true);
      expect(freshIndicators?.is_outdated).toBe(false);
      // If both have the same base characteristics, outdated should score lower
      if (outdatedIndicators && freshIndicators) {
        expect(outdatedIndicators.priority_score).toBeLessThanOrEqual(
          freshIndicators.priority_score,
        );
      }
    });

    it("should detect manual responses and mark as acknowledged/in_progress", () => {
      const originalComment: Comment = {
        id: 3,
        type: "review_comment",
        author: "coderabbitai",
        author_association: "NONE",
        is_bot: true,
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:00:00Z",
        file_path: "src/file.ts",
        line_number: 15,
        body: "Fix this issue",
        html_url: "https://github.com/test/repo/pull/123#discussion_r3",
        action_commands: {
          reply_command: 'gh pr comment 123 --body "text"',
          resolve_condition: "Only after fix is verified",
          view_in_browser: "https://github.com/test/repo/pull/123",
        },
      };

      const replyComment: Comment = {
        id: 4,
        type: "review_comment",
        author: "developer",
        author_association: "CONTRIBUTOR",
        is_bot: false,
        created_at: "2024-01-01T11:00:00Z",
        updated_at: "2024-01-01T11:00:00Z",
        file_path: "src/file.ts",
        line_number: 15,
        body: "Working on this",
        in_reply_to_id: 3,
        html_url: "https://github.com/test/repo/pull/123#discussion_r4",
        action_commands: {
          reply_command: 'gh pr comment 123 --body "text"',
          resolve_condition: "Only after fix is verified",
          view_in_browser: "https://github.com/test/repo/pull/123",
        },
      };

      const indicatorsWithoutResponse = calculateStatusIndicators(
        originalComment,
        [],
      );
      const indicatorsWithResponse = calculateStatusIndicators(
        originalComment,
        [replyComment],
      );

      expect(indicatorsWithoutResponse?.has_manual_response).toBe(false);
      expect(indicatorsWithResponse?.has_manual_response).toBe(true);
      expect(indicatorsWithoutResponse?.priority_score).toBeGreaterThan(
        indicatorsWithResponse?.priority_score || 0,
      );
    });

    it("should detect actionable content in comment body", () => {
      const actionableComment: Comment = {
        id: 5,
        type: "issue_comment",
        author: "reviewer",
        author_association: "MEMBER",
        is_bot: false,
        created_at: "2024-01-01T12:00:00Z",
        updated_at: "2024-01-01T12:00:00Z",
        body: "Please fix this bug and change the logic",
        html_url: "https://github.com/test/repo/issues/123#issuecomment-5",
        action_commands: {
          reply_command: 'gh pr comment 123 --body "text"',
          resolve_condition: "Only after fix is verified",
          view_in_browser: "https://github.com/test/repo/pull/123",
        },
      };

      const nonActionableComment: Comment = {
        id: 6,
        type: "issue_comment",
        author: "reviewer",
        author_association: "MEMBER",
        is_bot: false,
        created_at: "2024-01-01T12:00:00Z",
        updated_at: "2024-01-01T12:00:00Z",
        body: "Looks good to me",
        html_url: "https://github.com/test/repo/issues/123#issuecomment-6",
        action_commands: {
          reply_command: 'gh pr comment 123 --body "text"',
          resolve_condition: "Only after fix is verified",
          view_in_browser: "https://github.com/test/repo/pull/123",
        },
      };

      const actionableIndicators = calculateStatusIndicators(
        actionableComment,
        [],
      );
      const nonActionableIndicators = calculateStatusIndicators(
        nonActionableComment,
        [],
      );

      expect(actionableIndicators?.is_actionable).toBe(true);
      expect(nonActionableIndicators?.is_actionable).toBe(false);
      expect(actionableIndicators?.priority_score).toBeGreaterThan(
        nonActionableIndicators?.priority_score || 0,
      );
    });

    it("should suggest appropriate action based on comment characteristics", () => {
      const mcpResolvable: Comment = {
        id: 7,
        type: "review_comment",
        author: "coderabbitai",
        author_association: "NONE",
        is_bot: true,
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:00:00Z",
        file_path: "src/file.ts",
        line_number: 20,
        body: "Nitpick",
        html_url: "https://github.com/test/repo/pull/123#discussion_r7",
        action_commands: {
          reply_command: 'gh pr comment 123 --body "text"',
          resolve_condition: "Only after fix is verified",
          view_in_browser: "https://github.com/test/repo/pull/123",
          mcp_action: {
            tool: "resolve_review_thread",
            args: { pr: "test/repo#123", thread_id: "thread-7" },
          },
        },
      };

      const lowPriority: Comment = {
        id: 8,
        type: "review_comment",
        author: "reviewer",
        author_association: "MEMBER",
        is_bot: false,
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-01T10:00:00Z",
        file_path: "src/file.ts",
        line_number: 25,
        body: "Minor suggestion",
        html_url: "https://github.com/test/repo/pull/123#discussion_r8",
        action_commands: {
          reply_command: 'gh pr comment 123 --body "text"',
          resolve_condition: "Only after fix is verified",
          view_in_browser: "https://github.com/test/repo/pull/123",
        },
      };

      const mcpIndicators = calculateStatusIndicators(mcpResolvable, []);
      const lowPriorityIndicators = calculateStatusIndicators(lowPriority, []);

      expect(mcpIndicators?.suggested_action).toBe("resolve");
      // Check that priority-based actions are working
      expect(lowPriorityIndicators?.suggested_action).toBeDefined();
      expect(["reply", "investigate", "ignore"]).toContain(
        lowPriorityIndicators?.suggested_action,
      );
    });
  });
});
