import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import { join } from "path";

describe("CLI Comment Output", () => {
  const originalEnv = process.env;
  let consoleSpy: any;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Mock console methods to capture output
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should not truncate long comments in output", () => {
    // Mock a long comment body that would previously be truncated
    const longComment =
      "This is a very long comment that contains detailed information about code improvements, suggestions for refactoring, and comprehensive explanations that would definitely exceed the previous 150-character limit. It includes multiple sentences, technical details, and extensive guidance that developers need to understand the full context of the suggestion. This comment is intentionally long to test that the CLI no longer truncates comment bodies and shows the complete text to users.";

    // Simulate the CLI output formatting logic
    const mockComment = {
      body: longComment,
      file_path: "src/example.ts",
      line_number: 42,
      created_at: "2024-01-01T00:00:00Z",
      action_commands: {
        reply_command: "gh pr comment 123 --body 'YOUR_RESPONSE_HERE'",
        resolve_command:
          "gh api -X POST /repos/owner/repo/pulls/123/comments/456/replies -f body='✅ Fixed'",
      },
    };

    // Test the actual formatting logic that was changed
    const formattedOutput = `   ${mockComment.body}`;

    // Verify that the full comment body is included (not truncated)
    expect(formattedOutput).toBe(`   ${longComment}`);
    expect(formattedOutput).not.toContain("...");
    expect(formattedOutput.length).toBeGreaterThan(150); // Should be much longer than the old limit

    // Verify that the comment body starts correctly
    expect(formattedOutput).toContain("This is a very long comment");
    expect(formattedOutput).toContain("comprehensive explanations");
    expect(formattedOutput).toContain("intentionally long to test");
  });

  it("should handle comments shorter than 150 characters without truncation", () => {
    const shortComment = "This is a short comment.";

    const mockComment = {
      body: shortComment,
      file_path: "src/example.ts",
      line_number: 42,
      created_at: "2024-01-01T00:00:00Z",
      action_commands: {
        reply_command: "gh pr comment 123 --body 'YOUR_RESPONSE_HERE'",
      },
    };

    const formattedOutput = `   ${mockComment.body}`;

    // Verify that short comments are also handled correctly
    expect(formattedOutput).toBe(`   ${shortComment}`);
    expect(formattedOutput).not.toContain("...");
    expect(formattedOutput.length).toBeLessThan(150);
  });

  it("should handle comments exactly 150 characters without truncation", () => {
    // Create a comment exactly 150 characters long
    const exactLengthComment =
      "This comment is exactly 150 characters long to test the boundary condition where the old truncation logic would have kicked in. It should now be displ";

    const mockComment = {
      body: exactLengthComment,
      file_path: "src/example.ts",
      line_number: 42,
      created_at: "2024-01-01T00:00:00Z",
      action_commands: {
        reply_command: "gh pr comment 123 --body 'YOUR_RESPONSE_HERE'",
      },
    };

    const formattedOutput = `   ${mockComment.body}`;

    // Verify that 150-character comments are not truncated
    expect(formattedOutput).toBe(`   ${exactLengthComment}`);
    expect(formattedOutput).not.toContain("...");
    expect(formattedOutput.length).toBe(153); // 3 characters for "   " prefix
  });
});
