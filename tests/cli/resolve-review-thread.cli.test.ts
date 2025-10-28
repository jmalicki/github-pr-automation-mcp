import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve } from "path";

describe("resolve-review-thread CLI", () => {
  const cliPath = resolve(process.cwd(), "dist/cli.js");

  it("should show help without requiring token", () => {
    const output = execSync(`node ${cliPath} resolve-review-thread --help`, {
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    expect(output).toContain("Resolve a specific review thread");
    expect(output).toContain("--pr <identifier>");
    expect(output).toContain("--thread-id <id>");
    expect(output).toContain("--comment-id <id>");
  });

  it("should require --pr argument", () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-thread`, {
        encoding: "utf-8",
        cwd: process.cwd(),
      });
    }).toThrow();
  });

  it("should require either --thread-id or --comment-id", () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-thread --pr "owner/repo#123"`, {
        encoding: "utf-8",
        cwd: process.cwd(),
        env: { ...process.env, GITHUB_TOKEN: "fake_token" },
      });
    }).toThrow(); // Should fail validation
  });
});
