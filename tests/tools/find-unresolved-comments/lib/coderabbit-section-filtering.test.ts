import { describe, it, expect } from "vitest";
import { parseCodeRabbitSections } from "../../../../src/tools/find-unresolved-comments/lib/coderabbit";

describe("CodeRabbit Section Filtering", () => {
  const mockReviewBody = `
<details>
<summary>🐛 Bugs (2)</summary>
<details>
<summary>\`src/file1.rs\` (1)</summary>
\`10-15\`: **Fix potential null pointer**
Description here
</details>
<details>
<summary>\`src/file2.rs\` (1)</summary>
\`20-25\`: **Handle edge case**
Description here
</details>
</details>

<details>
<summary>💡 Suggestions (2)</summary>
<details>
<summary>\`src/file3.rs\` (1)</summary>
\`30-35\`: **Consider using Option**
Description here
</details>
<details>
<summary>\`src/file4.rs\` (1)</summary>
\`40-45\`: **Add error handling**
Description here
</details>
</details>

<details>
<summary>🧹 Nitpicks (2)</summary>
<details>
<summary>\`src/file5.rs\` (1)</summary>
\`50-55\`: **Minor style improvement**
Description here
</details>
<details>
<summary>\`src/file6.rs\` (1)</summary>
\`60-65\`: **Unused variable**
Description here
</details>
</details>

<details>
<summary>♻️ Duplicates (2)</summary>
<details>
<summary>\`src/file7.rs\` (1)</summary>
\`70-75\`: **Similar logic exists elsewhere**
Description here
</details>
<details>
<summary>\`src/file8.rs\` (1)</summary>
\`80-85\`: **Duplicate function**
Description here
</details>
</details>

<details>
<summary>📜 Additional (2)</summary>
<details>
<summary>\`src/file9.rs\` (1)</summary>
\`90-95\`: **Consider documentation**
Description here
</details>
<details>
<summary>\`src/file10.rs\` (1)</summary>
\`100-105\`: **Performance optimization**
Description here
</details>
</details>
`;

  it("should parse all section types correctly", () => {
    const sections = parseCodeRabbitSections(mockReviewBody);

    console.log(
      "Parsed sections:",
      sections.map((s) => ({ type: s.type, title: s.title, count: s.count })),
    );

    expect(sections).toHaveLength(5);
    expect(sections.map((s) => s.type)).toEqual([
      "actionable", // Bugs
      "actionable", // Suggestions
      "nit", // Nits
      "duplicate", // Duplicates
      "additional", // Additional
    ]);

    // Check that each section has items
    sections.forEach((section) => {
      expect(section.items.length).toBeGreaterThan(0);
    });
  });

  it("should filter sections by suggestion_types", () => {
    const sections = parseCodeRabbitSections(mockReviewBody);

    // Test including only specific types
    const filteredSections = sections.filter((section) =>
      ["actionable", "nit"].includes(section.type),
    );

    expect(filteredSections).toHaveLength(3); // Bugs + Suggestions + Nits
    expect(filteredSections.map((s) => s.type)).toEqual([
      "actionable",
      "actionable",
      "nit",
    ]);
  });

  it("should handle empty review body", () => {
    const sections = parseCodeRabbitSections("");
    expect(sections).toHaveLength(0);
  });

  it("should handle review body without sections", () => {
    const sections = parseCodeRabbitSections(
      "Just some regular text without sections",
    );
    expect(sections).toHaveLength(0);
  });

  it("should handle malformed section headers", () => {
    const malformedBody = `
## CodeRabbit Review
### Bugs (malformed)
- Some item
### Suggestions
- Another item
`;
    const sections = parseCodeRabbitSections(malformedBody);

    // Should still parse what it can
    expect(sections.length).toBeGreaterThan(0);
  });
});
