import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema } from "@alcyone-labs/zod-to-json-schema";
import { FindUnresolvedCommentsSchema } from "../src/tools/find-unresolved-comments/schema.js";
import fs from "fs";

/**
 * Schema Synchronization Tests
 *
 * This test suite ensures that the Zod schema generates JSON Schema that exactly
 * matches the manual MCP schema defined in src/index.ts. This is critical for
 * maintaining API consistency and preventing schema drift.
 *
 * ## Background: The Zod v4 JSON Schema Bug
 *
 * Zod v4's built-in z.toJSONSchema() has a critical bug where it incorrectly
 * marks fields with default values as "required" in the generated JSON Schema,
 * even when they are explicitly marked as optional using .optional().
 *
 * This bug makes it impossible to generate accurate MCP schemas using Zod v4's
 * built-in JSON Schema generation, because MCP clients expect optional fields
 * to NOT be in the "required" array, even if they have defaults.
 *
 * ## Our Solution
 *
 * We use @alcyone-labs/zod-to-json-schema, which is a fork of the original
 * zod-to-json-schema library that supports Zod v4 and correctly handles
 * optional fields with defaults.
 *
 * ## Test Process
 *
 * 1. Load the "gold standard" manual MCP schema from tests/saved-mcp-schema.json
 *    (extracted from src/index.ts)
 * 2. Generate JSON Schema from our Zod schema using zodToJsonSchema()
 * 3. Compare the two schemas field by field
 * 4. Report any differences
 *
 * ## What This Test Validates
 *
 * - All properties exist in both schemas
 * - Property types match (string, boolean, array, object)
 * - Default values match
 * - Descriptions match (including emoji annotations)
 * - Enum values match
 * - Required/optional field status matches
 * - Nested object structures match
 *
 * ## Why This Matters
 *
 * This test prevents schema drift between the Zod schema (source of truth for
 * validation) and the MCP schema (what clients see). Without this test, it's
 * easy for the schemas to get out of sync, leading to:
 *
 * - Clients sending invalid requests
 * - Server rejecting valid requests
 * - Documentation mismatches
 * - Runtime errors
 *
 * @see {@link https://github.com/alcyone-labs/zod-to-json-schema} - Zod v4 compatible JSON Schema generator
 * @see {@link https://github.com/colinhacks/zod/issues/1643} - Zod issue about optional fields
 * @see {@link https://github.com/colinhacks/zod/issues/4179} - Zod issue about default values
 */
describe("Schema Synchronization", () => {
  it("should have generated Zod schema match saved MCP schema", async () => {
    // Load the saved MCP schema from index.ts
    const savedSchemaContent = fs.readFileSync(
      "tests/saved-mcp-schema.json",
      "utf8",
    );
    const savedSchema = JSON.parse(savedSchemaContent);

    // Generate MCP schema from Zod using the working library
    // NOTE: We use @alcyone-labs/zod-to-json-schema instead of z.toJSONSchema()
    // because Zod v4's built-in JSON Schema generation has a bug with optional fields
    const generatedSchema = zodToJsonSchema(FindUnresolvedCommentsSchema);

    // Compare schemas and report differences
    const differences = compareSchemas(savedSchema, generatedSchema, "");

    if (differences.length > 0) {
      console.log("\n=== SCHEMA DIFFERENCES FOUND ===");
      differences.forEach((diff) => console.log(diff));
      console.log("===============================\n");

      // Fail the test if there are differences
      // This ensures we maintain perfect schema synchronization
      expect(differences).toHaveLength(0);
    }
  });
});

/**
 * Recursively compare two JSON schemas and return a list of differences
 *
 * This function performs a deep comparison of JSON schemas, checking:
 * - Top-level properties (type, required, properties)
 * - Individual property types, descriptions, defaults, enums
 * - Nested object structures
 * - Array item schemas
 *
 * @param saved - The "gold standard" schema from manual MCP definition
 * @param generated - The schema generated from Zod
 * @param path - Current path in the schema (for nested comparisons)
 * @returns Array of difference descriptions
 */
function compareSchemas(saved: any, generated: any, path: string): string[] {
  const differences: string[] = [];

  // Compare top-level properties
  if (saved.type !== generated.type) {
    differences.push(
      `${path}.type: saved="${saved.type}" vs generated="${generated.type}"`,
    );
  }

  // Compare required arrays
  // NOTE: This is the critical test - optional fields with defaults should NOT be in required array
  const savedRequired = saved.required || [];
  const generatedRequired = generated.required || [];
  if (
    JSON.stringify(savedRequired.sort()) !==
    JSON.stringify(generatedRequired.sort())
  ) {
    differences.push(
      `${path}.required: saved=${JSON.stringify(savedRequired)} vs generated=${JSON.stringify(generatedRequired)}`,
    );
  }

  // Compare properties
  const savedProps = saved.properties || {};
  const generatedProps = generated.properties || {};

  const allPropKeys = new Set([
    ...Object.keys(savedProps),
    ...Object.keys(generatedProps),
  ]);

  for (const key of allPropKeys) {
    const currentPath = path
      ? `${path}.properties.${key}`
      : `properties.${key}`;

    if (!savedProps[key]) {
      differences.push(`${currentPath}: missing in saved schema`);
      continue;
    }

    if (!generatedProps[key]) {
      differences.push(`${currentPath}: missing in generated schema`);
      continue;
    }

    // Compare individual property
    const propDifferences = compareProperty(
      savedProps[key],
      generatedProps[key],
      currentPath,
    );
    differences.push(...propDifferences);
  }

  return differences;
}

/**
 * Compare individual property schemas
 *
 * @param saved - Property schema from manual MCP definition
 * @param generated - Property schema generated from Zod
 * @param path - Current path in the schema
 * @returns Array of difference descriptions
 */
function compareProperty(saved: any, generated: any, path: string): string[] {
  const differences: string[] = [];

  // Compare type
  if (saved.type !== generated.type) {
    differences.push(
      `${path}.type: saved="${saved.type}" vs generated="${generated.type}"`,
    );
  }

  // Compare description
  if (saved.description !== generated.description) {
    differences.push(
      `${path}.description: saved="${saved.description}" vs generated="${generated.description || "undefined"}"`,
    );
  }

  // Compare default
  if (JSON.stringify(saved.default) !== JSON.stringify(generated.default)) {
    differences.push(
      `${path}.default: saved=${JSON.stringify(saved.default)} vs generated=${JSON.stringify(generated.default)}`,
    );
  }

  // Compare enum
  if (saved.enum && generated.enum) {
    if (
      JSON.stringify(saved.enum.sort()) !==
      JSON.stringify(generated.enum.sort())
    ) {
      differences.push(
        `${path}.enum: saved=${JSON.stringify(saved.enum)} vs generated=${JSON.stringify(generated.enum)}`,
      );
    }
  } else if (saved.enum && !generated.enum) {
    differences.push(`${path}.enum: missing in generated schema`);
  } else if (!saved.enum && generated.enum) {
    differences.push(`${path}.enum: extra in generated schema`);
  }

  // Compare items (for arrays)
  if (saved.items && generated.items) {
    const itemDifferences = compareProperty(
      saved.items,
      generated.items,
      `${path}.items`,
    );
    differences.push(...itemDifferences);
  }

  // Compare nested properties (for objects)
  if (saved.properties && generated.properties) {
    const nestedDifferences = compareSchemas(saved, generated, path);
    differences.push(...nestedDifferences);
  }

  return differences;
}
