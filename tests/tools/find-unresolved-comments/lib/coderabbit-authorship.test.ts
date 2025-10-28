import { describe, it, expect } from "vitest";
import { isCodeRabbitAuthor } from "../../../../src/tools/find-unresolved-comments/lib/coderabbit";

describe("CodeRabbit Authorship Checking", () => {
  it("should recognize CodeRabbit AI as author", () => {
    expect(isCodeRabbitAuthor("coderabbitai")).toBe(true);
    expect(isCodeRabbitAuthor("CodeRabbitAI")).toBe(true);
    expect(isCodeRabbitAuthor("coderabbit")).toBe(true);
    expect(isCodeRabbitAuthor("CodeRabbit")).toBe(true);
  });

  it("should reject non-CodeRabbit authors", () => {
    expect(isCodeRabbitAuthor("github-actions")).toBe(false);
    expect(isCodeRabbitAuthor("dependabot")).toBe(false);
    expect(isCodeRabbitAuthor("user123")).toBe(false);
    expect(isCodeRabbitAuthor("")).toBe(false);
  });

  it("should handle case variations", () => {
    expect(isCodeRabbitAuthor("CODERABBITAI")).toBe(true);
    expect(isCodeRabbitAuthor("CodeRabbitAI")).toBe(true);
    expect(isCodeRabbitAuthor("coderabbitai")).toBe(true);
  });
});
