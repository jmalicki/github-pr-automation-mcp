import { describe, it, expect } from "vitest";
import { createCodeRabbitComment } from "../../../../src/tools/find-unresolved-comments/lib/coderabbit";
import type { Review } from "../../../../src/tools/find-unresolved-comments/types";

describe("CodeRabbit Comment Creation", () => {
  const mockReview: Review = {
    id: 123,
    node_id: "abc123",
    user: { login: "coderabbitai", id: 1, node_id: "user123", type: "Bot" },
    body: "Test review body",
    state: "COMMENTED",
    html_url: "https://github.com/test/repo/pull/1#pullrequestreview-123",
    pull_request_url: "https://api.github.com/repos/test/repo/pulls/1",
    author_association: "NONE",
    _links: {
      html: {
        href: "https://github.com/test/repo/pull/1#pullrequestreview-123",
      },
      pull_request: { href: "https://api.github.com/repos/test/repo/pulls/1" },
    },
    submitted_at: "2023-01-01T00:00:00Z",
    commit_id: "commit123",
  };

  const mockPr = { owner: "test", repo: "repo", number: 1 };

  it("should create comment from nit suggestion", () => {
    const item = {
      file_path: "src/file.rs",
      line_range: "10-15",
      title: "Minor style improvement",
      description: "Consider using a more descriptive variable name",
      code_suggestion: {
        old_code: "let x = 5;",
        new_code: "let count = 5;",
        language: "rust",
      },
      severity: "low",
    };

    const comment = createCodeRabbitComment(
      item,
      "nit",
      mockReview,
      mockPr,
      "coderabbitai",
      "NONE",
      true,
      undefined,
      true,
    );

    expect(comment).toMatchObject({
      type: "review",
      author: "coderabbitai",
      author_association: "NONE",
      is_bot: true,
      file_path: "src/file.rs",
      line_number: 10,
      body: expect.stringContaining("Minor style improvement"),
    });

    expect(comment.coderabbit_metadata).toMatchObject({
      suggestion_type: "nit",
      severity: "low",
      file_context: {
        path: "src/file.rs",
        line_start: 10,
        line_end: 15,
      },
    });
  });

  it("should create comment from actionable suggestion", () => {
    const item = {
      file_path: "src/file.rs",
      line_range: "20-25",
      title: "Fix potential null pointer",
      description: "This could cause a runtime error",
      code_suggestion: {
        old_code: "let result = obj.method();",
        new_code: "let result = obj.as_ref()?.method();",
        language: "rust",
      },
      severity: "high",
    };

    const comment = createCodeRabbitComment(
      item,
      "actionable",
      mockReview,
      mockPr,
      "coderabbitai",
      "NONE",
      true,
      undefined,
      true,
    );

    expect(comment.coderabbit_metadata).toMatchObject({
      suggestion_type: "actionable",
      severity: "high",
    });
  });

  it("should handle comments without code suggestions", () => {
    const item = {
      file_path: "src/file.rs",
      line_range: "30-35",
      title: "Consider documentation",
      description: "This function should be documented",
      code_suggestion: null,
      severity: "medium",
    };

    const comment = createCodeRabbitComment(
      item,
      "additional",
      mockReview,
      mockPr,
      "coderabbitai",
      "NONE",
      true,
      undefined,
      true,
    );

    expect(comment.coderabbit_metadata.code_suggestion).toBeNull();
  });

  it("should generate proper action commands", () => {
    const item = {
      file_path: "src/file.rs",
      line_range: "10-15",
      title: "Test suggestion",
      description: "Test description",
      code_suggestion: null,
      severity: "low",
    };

    const comment = createCodeRabbitComment(
      item,
      "nit",
      mockReview,
      mockPr,
      "coderabbitai",
      "NONE",
      true,
      undefined,
      true,
    );

    expect(comment.action_commands).toMatchObject({
      reply_command:
        'gh pr comment 1 --repo test/repo --body "YOUR_RESPONSE_HERE"',
      view_in_browser: "gh pr view 1 --repo test/repo --web",
    });
  });
});
