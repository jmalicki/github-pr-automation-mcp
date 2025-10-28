import { describe, it, expect } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { parseCodeRabbitSections } from "../../../../src/tools/find-unresolved-comments/lib/coderabbit";

describe("CodeRabbit parse from fixture", () => {
  it("parses sections and items from real review body", async () => {
    const reviewPath = path.join(
      __dirname,
      "test-data",
      "coderabbit-filter",
      "prs",
      "review-PRR_kwDOQKdW-c7J2-Rw.json",
    );
    const reviewData = JSON.parse(await fs.readFile(reviewPath, "utf8"));
    const body: string = reviewData.data.node.body;

    const sections = parseCodeRabbitSections(body);

    // Should have at least one section
    expect(sections.length).toBeGreaterThan(0);

    // Sum items across sections
    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    expect(totalItems).toBeGreaterThan(0);
  });
});
