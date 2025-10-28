import { describe, it, expect } from 'vitest';
import { generateSummary } from '../../../../src/tools/find-unresolved-comments/lib/summary-generator.js';
import type { Comment } from '../../../../src/tools/find-unresolved-comments/schema.js';

describe('summary-generator', () => {
  describe('generateSummary', () => {
    it('should generate basic summary statistics', () => {
      const comments: Comment[] = [
        {
          id: 1,
          type: 'review_comment',
          author: 'alice',
          author_association: 'MEMBER',
          is_bot: false,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          file_path: 'src/file.ts',
          line_number: 10,
          body: 'Comment 1',
          html_url: 'https://github.com/test/repo/pull/123#discussion_r1',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          }
        },
        {
          id: 2,
          type: 'issue_comment',
          author: 'bob',
          author_association: 'CONTRIBUTOR',
          is_bot: false,
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          body: 'Comment 2',
          html_url: 'https://github.com/test/repo/issues/123#issuecomment-2',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          }
        },
        {
          id: 3,
          type: 'review',
          author: 'coderabbitai',
          author_association: 'NONE',
          is_bot: true,
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          body: 'Bot comment',
          html_url: 'https://github.com/test/repo/pull/123',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          }
        }
      ];

      const summary = generateSummary(comments, false, false);

      expect(summary.comments_in_page).toBe(3);
      expect(summary.by_author).toEqual({ alice: 1, bob: 1, coderabbitai: 1 });
      expect(summary.by_type).toEqual({ review_comment: 1, issue_comment: 1, review: 1 });
      expect(summary.bot_comments).toBe(1);
      expect(summary.human_comments).toBe(2);
    });

    it('should count comments with reactions', () => {
      const comments: Comment[] = [
        {
          id: 1,
          type: 'review_comment',
          author: 'alice',
          author_association: 'MEMBER',
          is_bot: false,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          file_path: 'src/file.ts',
          line_number: 10,
          body: 'Comment with reactions',
          html_url: 'https://github.com/test/repo/pull/123#discussion_r1',
          reactions: { total_count: 2, '+1': 2, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 },
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          }
        },
        {
          id: 2,
          type: 'review_comment',
          author: 'bob',
          author_association: 'MEMBER',
          is_bot: false,
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          file_path: 'src/file.ts',
          line_number: 15,
          body: 'Comment without reactions',
          html_url: 'https://github.com/test/repo/pull/123#discussion_r2',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 },
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          }
        }
      ];

      const summary = generateSummary(comments, false, false);

      expect(summary.with_reactions).toBe(1);
    });

    it('should include priority summary when status indicators enabled', () => {
      const comments: Comment[] = [
        {
          id: 1,
          type: 'review',
          author: 'coderabbitai',
          author_association: 'NONE',
          is_bot: true,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          body: 'High priority comment',
          html_url: 'https://github.com/test/repo/pull/123',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          },
          status_indicators: {
            priority_score: 85,
            needs_mcp_resolution: true,
            has_manual_response: false,
            is_actionable: true,
            is_outdated: false,
            resolution_status: 'unresolved',
            suggested_action: 'resolve'
          }
        },
        {
          id: 2,
          type: 'review',
          author: 'coderabbitai',
          author_association: 'NONE',
          is_bot: true,
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          body: 'Medium priority comment',
          html_url: 'https://github.com/test/repo/pull/123',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          },
          status_indicators: {
            priority_score: 50,
            needs_mcp_resolution: false,
            has_manual_response: false,
            is_actionable: true,
            is_outdated: false,
            resolution_status: 'unresolved',
            suggested_action: 'reply'
          }
        },
        {
          id: 3,
          type: 'review',
          author: 'coderabbitai',
          author_association: 'NONE',
          is_bot: true,
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          body: 'Low priority comment',
          html_url: 'https://github.com/test/repo/pull/123',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          },
          status_indicators: {
            priority_score: 15,
            needs_mcp_resolution: false,
            has_manual_response: false,
            is_actionable: false,
            is_outdated: false,
            resolution_status: 'unresolved',
            suggested_action: 'ignore'
          }
        }
      ];

      const summary = generateSummary(comments, true, false);

      expect(summary.priority_summary).toBeDefined();
      expect(summary.priority_summary?.high_priority).toBe(1); // Score >= 70
      expect(summary.priority_summary?.medium_priority).toBe(1); // Score 30-69
      expect(summary.priority_summary?.low_priority).toBe(1); // Score < 30
      expect(summary.priority_summary?.needs_mcp_resolution).toBe(1);
      expect(summary.priority_summary?.actionable_items).toBe(2);
    });

    it('should include status groups when priority ordering enabled', () => {
      const comments: Comment[] = [
        {
          id: 1,
          type: 'review',
          author: 'reviewer',
          author_association: 'MEMBER',
          is_bot: false,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          body: 'Unresolved',
          html_url: 'https://github.com/test/repo/pull/123',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          },
          status_indicators: {
            priority_score: 40,
            needs_mcp_resolution: false,
            has_manual_response: false,
            is_actionable: true,
            is_outdated: false,
            resolution_status: 'unresolved',
            suggested_action: 'reply'
          }
        },
        {
          id: 2,
          type: 'review',
          author: 'reviewer',
          author_association: 'MEMBER',
          is_bot: false,
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          body: 'Acknowledged',
          html_url: 'https://github.com/test/repo/pull/123',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          },
          status_indicators: {
            priority_score: 30,
            needs_mcp_resolution: false,
            has_manual_response: true,
            is_actionable: false,
            is_outdated: false,
            resolution_status: 'acknowledged',
            suggested_action: 'investigate'
          }
        },
        {
          id: 3,
          type: 'review',
          author: 'reviewer',
          author_association: 'MEMBER',
          is_bot: false,
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          body: 'In progress',
          html_url: 'https://github.com/test/repo/pull/123',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          },
          status_indicators: {
            priority_score: 50,
            needs_mcp_resolution: false,
            has_manual_response: true,
            is_actionable: true,
            is_outdated: false,
            resolution_status: 'in_progress',
            suggested_action: 'reply'
          }
        }
      ];

      const summary = generateSummary(comments, true, true);

      expect(summary.status_groups).toBeDefined();
      expect(summary.status_groups?.unresolved).toHaveLength(1);
      expect(summary.status_groups?.acknowledged).toHaveLength(1);
      expect(summary.status_groups?.in_progress).toHaveLength(1);
      expect(summary.status_groups?.resolved).toHaveLength(0);
    });

    it('should not include priority summary when status indicators disabled', () => {
      const comments: Comment[] = [
        {
          id: 1,
          type: 'review_comment',
          author: 'reviewer',
          author_association: 'MEMBER',
          is_bot: false,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          file_path: 'src/file.ts',
          line_number: 10,
          body: 'Comment',
          html_url: 'https://github.com/test/repo/pull/123#discussion_r1',
          action_commands: {
            reply_command: 'gh pr comment 123 --body "text"',
            resolve_condition: 'Only after fix is verified',
            view_in_browser: 'https://github.com/test/repo/pull/123'
          }
        }
      ];

      const summary = generateSummary(comments, false, false);

      expect(summary.priority_summary).toBeUndefined();
      expect(summary.status_groups).toBeUndefined();
    });
  });
});
