import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import type { Comment } from "../schema.js";
import { generateActionCommands } from "../command-generator.js";
import { calculateStatusIndicators } from "./status-indicators.js";

/**
 * Safe synthetic IDs for generated "review" comments.
 * 
 * CodeRabbit reviews don't have individual comment IDs in the GitHub API,
 * so we generate negative, monotonic IDs to distinguish them from real
 * GitHub comment IDs (which are always positive).
 * 
 * Starting at -1 and decrementing ensures no collision with real IDs.
 */
let __tempReviewCommentId = -1;

type Review =
  RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"][number];

/**
 * Configuration options for CodeRabbit review parsing and filtering.
 * 
 * These options control which types of CodeRabbit suggestions are included
 * and how they are processed and prioritized.
 */
export interface CodeRabbitOptions {
  /** Include nitpick suggestions (minor style/formatting issues) */
  include_nits?: boolean;
  /** Include duplicate code detection suggestions */
  include_duplicates?: boolean;
  /** Include additional suggestions (enhancements, improvements) */
  include_additional?: boolean;
  /** Specific suggestion types to include (filters others out) */
  suggestion_types?: string[];
  /** Sort actionable items first when prioritizing */
  prioritize_actionable?: boolean;
  /** Group comments by suggestion type in output */
  group_by_type?: boolean;
  /** Generate AI agent prompts from suggestions */
  extract_agent_prompts?: boolean;
}

/**
 * Parse CodeRabbit AI review body for actionable comments.
 *
 * This is the main entry point for CodeRabbit review processing. It handles
 * the complex task of parsing CodeRabbit's structured review format and
 * converting it into standardized Comment objects.
 *
 * ## CodeRabbit Review Format
 * 
 * CodeRabbit reviews use a structured HTML format with collapsible sections:
 * - 🧹 Nitpicks: Minor style/formatting issues
 * - ♻️ Duplicate code: Code duplication suggestions  
 * - 📜 Additional suggestions: Enhancement recommendations
 * - Actionable items: Must-fix issues (no emoji, just "Actionable items: N")
 *
 * Each section contains individual suggestions with:
 * - File path and line range
 * - Description of the issue
 * - Optional code diff suggestions
 * - Severity level (inferred from section type)
 *
 * ## Processing Pipeline
 * 
 * 1. **Section Parsing**: Extract structured sections from HTML
 * 2. **Item Extraction**: Parse individual suggestions within sections
 * 3. **Code Diff Parsing**: Extract code suggestions from diff blocks
 * 4. **Comment Creation**: Convert to standardized Comment objects
 * 5. **Filtering**: Apply user-specified filtering options
 * 6. **Sorting**: Apply prioritization and grouping if requested
 *
 * @param body - The raw review body text from CodeRabbit (HTML format)
 * @param review - The full GitHub review object containing metadata
 * @param pr - Pull request information (owner, repo, number)
 * @param author - Review author username (should be 'coderabbitai')
 * @param authorAssociation - GitHub author association (e.g., 'NONE', 'MEMBER')
 * @param isBot - Whether the author is marked as a bot account
 * @param options - CodeRabbit-specific parsing and filtering options
 * @param includeStatusIndicators - Whether to calculate status indicators
 * @returns Array of parsed Comment objects representing CodeRabbit suggestions
 * 
 * @example
 * ```typescript
 * const comments = parseCodeRabbitReview(
 *   reviewBody,
 *   review,
 *   { owner: 'owner', repo: 'repo', number: 123 },
 *   'coderabbitai',
 *   'NONE',
 *   true,
 *   { include_nits: false, prioritize_actionable: true }
 * );
 * ```
 */
export function parseCodeRabbitReview(
  body: string,
  review: Review,
  pr: { owner: string; repo: string; number: number },
  author: string,
  authorAssociation: string,
  isBot: boolean,
  options?: CodeRabbitOptions,
  includeStatusIndicators?: boolean,
): Comment[] {
  const comments: Comment[] = [];

  // Parse structured CodeRabbit sections
  const sections = parseCodeRabbitSections(body);

  for (const section of sections) {
    // Apply filtering based on options
    if (options) {
      if (
        options.suggestion_types &&
        !options.suggestion_types.includes(section.type)
      ) {
        continue;
      }

      switch (section.type) {
        case "nit":
          if (options.include_nits === false) continue;
          break;
        case "duplicate":
          if (options.include_duplicates === false) continue;
          break;
        case "additional":
          if (options.include_additional === false) continue;
          break;
        case "actionable":
          // Always include actionable items
          break;
      }
    }

    // Parse individual items in this section
    for (const item of section.items) {
      const comment = createCodeRabbitComment(
        item,
        section.type,
        review,
        pr,
        author,
        authorAssociation,
        isBot,
        options,
        includeStatusIndicators,
      );
      comments.push(comment);
    }
  }

  // Apply final filtering based on options
  if (options) {
    return applyCodeRabbitFiltering(comments, options);
  }

  return comments;
}

/**
 * Parse CodeRabbit structured sections from review body.
 *
 * This function handles the complex task of parsing CodeRabbit's HTML-based
 * review format into structured data. CodeRabbit uses collapsible HTML sections
 * with specific patterns that need careful parsing.
 *
 * ## Section Types and Patterns
 *
 * CodeRabbit reviews contain these section types:
 * - 🧹 Nitpicks: Minor style/formatting issues (low severity)
 * - ♻️ Duplicate code: Code duplication suggestions (medium severity)  
 * - 📜 Additional suggestions: Enhancement recommendations (medium severity)
 * - Actionable items: Must-fix issues (high severity, no emoji)
 *
 * ## HTML Structure Parsed
 *
 * Each section follows this pattern:
 * ```html
 * <details>
 *   <summary>🧹 Nitpicks (3)</summary>
 *   <!-- section content -->
 * </details>
 * ```
 *
 * Within sections, individual suggestions follow:
 * ```html
 * <summary>`file.ts` (2)</summary>
 * `42: **Issue description**`
 * ```diff
 * - old code
 * + new code  
 * ```
 * ```
 *
 * ## Parsing Strategy
 *
 * The function uses a state machine approach:
 * 1. **Section Detection**: Look for `<details><summary>` patterns with emojis
 * 2. **File Context**: Track current file from nested summaries
 * 3. **Item Parsing**: Extract line ranges and descriptions
 * 4. **Code Block Parsing**: Handle diff blocks with special escaping
 * 5. **State Management**: Track parsing state across lines
 *
 * ## Edge Cases Handled
 *
 * - Escaped backticks in diff blocks (`\`\`\`diff`)
 * - Multi-line descriptions spanning multiple lines
 * - Missing or malformed line ranges
 * - Nested HTML structures
 * - Actionable items without emoji indicators
 *
 * @param body - Raw HTML review body from CodeRabbit
 * @returns Array of parsed sections with items and metadata
 */
function parseCodeRabbitSections(body: string): Array<{
  type: "nit" | "duplicate" | "additional" | "actionable";
  title: string;
  count: number;
  content: string;
  items: Array<{
    file_path: string;
    line_range: string;
    title: string;
    description: string;
    code_suggestion?: {
      old_code: string;
      new_code: string;
      language: string;
    };
    severity: "low" | "medium" | "high";
  }>;
}> {
  const sections: Array<{
    type: "nit" | "duplicate" | "additional" | "actionable";
    title: string;
    count: number;
    content: string;
    items: Array<{
      file_path: string;
      line_range: string;
      title: string;
      description: string;
      code_suggestion?: {
        old_code: string;
        new_code: string;
        language: string;
      };
      severity: "low" | "medium" | "high";
    }>;
  }> = [];

  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
  
  // Split the HTML body into lines for line-by-line parsing
  const lines = body.split("\n");
  
  // State variables for the parsing state machine
  let currentSection: any = null;  // Currently active section being parsed
  let currentItem: any = null;     // Currently active item being parsed
  let currentFile = "";            // Current file context from nested summaries

  // Main parsing loop - process each line sequentially
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section headers - CodeRabbit uses <details><summary> structure
    // We need to check the next line for the actual summary content
    if (line.includes("<details>") && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      
      // Parse section headers with emoji indicators
      // Pattern: <summary>🧹 Nitpicks (3)</summary>
      const sectionMatch = nextLine.match(
        /<summary>\s*(🧹|♻️|♻|📜)\s*([^<]+)\s*\((\d+)\)\s*<\/summary>/u,
      );
      if (sectionMatch) {
        const emoji = sectionMatch[1];
        const title = sectionMatch[2].trim();
        const count = parseInt(sectionMatch[3]);

        // Map emoji to section type for consistent processing
        let type: "nit" | "duplicate" | "additional" | "actionable";
        if (emoji.includes("🧹")) type = "nit";           // Cleaning/nitpicks
        else if (emoji.includes("♻")) type = "duplicate";  // Recycling/duplicates
        else if (emoji.includes("📜")) type = "additional"; // Scroll/additional
        else type = "actionable";                         // Fallback

        // Create new section and add to results
        currentSection = {
          type,
          title,
          count,
          content: "",
          items: [],
        };
        sections.push(currentSection);
        i++; // Skip the summary line since we processed it
        continue;
      }

      // Handle actionable comments without emoji indicators
      // Pattern: <summary>Actionable items: 2</summary>
      const actionableMatch = nextLine.match(
        /<summary>\s*([^<]+)\s*:\s*(\d+)\s*<\/summary>/u,
      );
      if (actionableMatch && nextLine.toLowerCase().includes("actionable")) {
        const title = actionableMatch[1].trim();
        const count = parseInt(actionableMatch[2]);

        // Create actionable section (highest priority)
        currentSection = {
          type: "actionable",
          title,
          count,
          content: "",
          items: [],
        };
        sections.push(currentSection);
        i++; // Skip the summary line since we processed it
        continue;
      }
    }

    // Detect file context within sections
    // Pattern: <summary>`src/file.ts` (2)</summary>
    // This establishes the current file for subsequent suggestions
    const fileMatch = line.match(
      /<summary>\s*`?([^<`]+?)`?\s*\((\d+)\)\s*<\/summary>/i,
    );
    if (fileMatch && currentSection) {
      currentFile = fileMatch[1];
      continue;
    }

    // Detect line range and suggestion content
    // Pattern: `42: **Issue description**` or `42-45: **Issue description**`
    const lineRangeMatch = line.match(
      /^(?:`|\\`)?(\d+(?:-\d+)?)(?:`|\\`)?:\s*\*\*(.*?)\*\*/,
    );
    if (lineRangeMatch && currentSection) {
      const lineRange = lineRangeMatch[1];
      const title = lineRangeMatch[2];

      // Extract description and code suggestion from subsequent lines
      let description = title;
      let codeSuggestion: any = null;
      let inCodeBlock = false;
      let codeBlockContent = "";

      // Look ahead up to 20 lines to find code blocks and descriptions
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        const nextLine = lines[j];

        // Detect start of code diff blocks (handle escaped backticks)
        if (
          nextLine.startsWith("```diff") ||
          nextLine.startsWith("\\`\\`\\`diff")
        ) {
          inCodeBlock = true;
          codeBlockContent = nextLine + "\n";
          description += "\n" + nextLine;
        } else if (inCodeBlock) {
          // Inside code block - accumulate content
          codeBlockContent += nextLine + "\n";
          description += "\n" + nextLine;
          
          // Detect end of code block (handle escaped backticks)
          if (nextLine.startsWith("```") || nextLine.startsWith("\\`\\`\\`")) {
            inCodeBlock = false;
            
            // Parse code suggestion from diff content
            // Extract old and new code from diff format
            const diffMatch =
              codeBlockContent.match(/```diff\n([\s\S]*?)\n```/) ||
              codeBlockContent.match(/\\`\\`\\`diff\n([\s\S]*?)\n\\`\\`\\`/);
            if (diffMatch) {
              const diffContent = diffMatch[1];
              
              // Parse diff lines: - for old code, + for new code
              const oldLines = diffContent
                .split("\n")
                .filter((l) => l.startsWith("-") && !l.startsWith("---"))
                .map((l) => l.substring(1)); // Remove the - prefix
              const newLines = diffContent
                .split("\n")
                .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
                .map((l) => l.substring(1)); // Remove the + prefix
              
              // Create code suggestion object
              codeSuggestion = {
                old_code: oldLines.join("\n"),
                new_code: newLines.join("\n"),
                language: "typescript", // Assume TypeScript for now
              };
            }
            break;
          }
        } else if (
          nextLine.trim() &&
          !nextLine.startsWith("---") &&
          !nextLine.startsWith("</blockquote>") &&
          !nextLine.startsWith("<summary>")
        ) {
          // Regular description line - add to description
          description += "\n" + nextLine;
        } else if (
          nextLine.startsWith("---") ||
          nextLine.startsWith("</blockquote>")
        ) {
          // End of suggestion - stop parsing
          break;
        }
      }

      // Create the parsed suggestion item
      currentItem = {
        file_path: currentFile || "unknown-file", // Use current file context or fallback
        line_range: lineRange,                   // Line number or range (e.g., "42" or "42-45")
        title,                                   // Main issue description
        description,                             // Full description including code blocks
        code_suggestion: codeSuggestion,        // Parsed code diff if present
        severity:                                // Infer severity from section type
          currentSection.type === "nit"
            ? "low"                              // Nitpicks are low severity
            : currentSection.type === "actionable"
              ? "high"                           // Actionable items are high severity
              : "medium",                        // Duplicates and additional are medium
      };

      // Add the item to the current section
      if (currentSection) {
        currentSection.items.push(currentItem);
      }
    }
  }

  return sections;
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
}

/**
 * Create a CodeRabbit comment with enhanced metadata and validation.
 *
 * This function converts a parsed CodeRabbit suggestion item into a standardized
 * Comment object with comprehensive metadata for downstream processing.
 *
 * ## Key Processing Steps
 *
 * 1. **Line Range Validation**: Safely parse and validate line numbers
 * 2. **ID Generation**: Create unique synthetic ID for tracking
 * 3. **Metadata Enhancement**: Add CodeRabbit-specific metadata
 * 4. **Action Commands**: Generate CLI/MCP commands for resolution
 * 5. **Status Indicators**: Calculate priority and resolution status
 *
 * ## Line Range Parsing
 *
 * Handles various line range formats:
 * - Single line: "42" → start=42, end=42
 * - Range: "42-45" → start=42, end=45
 * - Invalid: "abc" → start=undefined, end=undefined
 *
 * ## CodeRabbit Metadata
 *
 * Each comment includes rich metadata:
 * - `suggestion_type`: nit, duplicate, additional, actionable
 * - `severity`: low, medium, high (inferred from type)
 * - `category`: security, performance, style, bug, general
 * - `file_context`: path and line information
 * - `code_suggestion`: parsed diff if available
 * - `agent_prompt`: AI-friendly prompt for resolution
 * - `implementation_guidance`: priority and effort estimates
 *
 * @param item - Parsed suggestion item from section parsing
 * @param suggestionType - Type of suggestion (nit, duplicate, etc.)
 * @param review - Original GitHub review object
 * @param pr - Pull request information
 * @param author - Review author username
 * @param authorAssociation - GitHub author association
 * @param isBot - Whether author is a bot
 * @param options - CodeRabbit parsing options
 * @param includeStatusIndicators - Whether to calculate status indicators
 * @returns Standardized Comment object with CodeRabbit metadata
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
function createCodeRabbitComment(
  item: any,
  suggestionType: string,
  review: any,
  pr: { owner: string; repo: string; number: number },
  author: string,
  authorAssociation: string,
  isBot: boolean,
  options?: any,
  includeStatusIndicators?: boolean,
): Comment {
  // Defensive parsing for line ranges - handle various formats safely
  // Input: "42", "42-45", "abc", "", null, undefined
  const [startStr, endStr] = String(item.line_range || "").split("-");
  const parsedStart = Number.parseInt(startStr, 10);
  const parsedEnd = endStr ? Number.parseInt(endStr, 10) : parsedStart;
  
  // Validate parsed numbers - must be finite and positive
  const s = Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : undefined;
  const e = Number.isFinite(parsedEnd) && parsedEnd > 0 ? parsedEnd : s;
  
  // Ensure valid range (end >= start)
  const lineStart = s && e && e >= s ? s : undefined;
  const lineEnd = s && e && e >= s ? e : undefined;

  // Generate AI agent prompt if requested (default: true)
  let agentPrompt: string | undefined;
  if (options?.extract_agent_prompts !== false) {
    agentPrompt = generateAgentPrompt(item, suggestionType);
  }

  // Create the standardized Comment object
  const comment: Comment = {
    id: __tempReviewCommentId--,                    // Generate unique negative ID
    type: "review",                                  // CodeRabbit suggestions are review type
    author,                                         // Review author (coderabbitai)
    author_association: authorAssociation,          // GitHub association
    is_bot: isBot,                                  // Bot flag
    created_at: review.submitted_at || review.created_at, // Use submission time if available
    updated_at: review.submitted_at || review.created_at, // Same as created for reviews
    file_path: item.file_path,                      // File path from parsing
    line_number: lineStart,                          // Validated start line
    body: item.description,                         // Full description with code blocks
    html_url: review.html_url,                      // Link to original review
    action_commands: generateActionCommands(        // Generate CLI/MCP commands
      pr,
      review.id,
      "review",
      item.description,
      item.file_path,
    ),
    coderabbit_metadata: {                          // Rich CodeRabbit-specific metadata
      suggestion_type: suggestionType as
        | "nit"
        | "duplicate"
        | "additional"
        | "actionable",
      severity: item.severity,                      // Parsed severity level
      category: inferCategory(item.description),    // Inferred category
      file_context: {                              // File and line context
        path: item.file_path,
        line_start: lineStart,
        line_end: lineEnd,
      },
      code_suggestion: item.code_suggestion,        // Parsed diff if available
      agent_prompt: agentPrompt,                    // AI-friendly prompt
      implementation_guidance: {                    // Resolution guidance
        priority: item.severity,
        effort_estimate:
          suggestionType === "nit"
            ? "Quick fix (1-2 minutes)"            // Nitpicks are quick
            : "Medium effort (2-5 minutes)",       // Others take more time
        rationale: item.description,                // Why this change is needed
      },
    },
  };

  // Add status indicators if enabled
  if (includeStatusIndicators !== false) {
    comment.status_indicators = calculateStatusIndicators(comment);
  }

  return comment;
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
}

/**
 * Generate AI agent-friendly prompt from CodeRabbit suggestion.
 *
 * Creates a structured prompt that AI agents can use to understand and
 * implement CodeRabbit suggestions. The prompt includes context, code
 * examples, and implementation guidance.
 *
 * ## Prompt Structure
 *
 * 1. **Context**: File path, line range, and suggestion type
 * 2. **Code Examples**: Current and suggested code (if available)
 * 3. **Priority**: Severity level and effort estimate
 * 4. **Guidance**: Implementation rationale and context
 *
 * @param item - Parsed suggestion item with file and code information
 * @param suggestionType - Type of suggestion (nit, duplicate, etc.)
 * @returns Formatted prompt string for AI agents
 */
function generateAgentPrompt(
  item: {
    file_path: string;
    line_range: string;
    code_suggestion?: { old_code: string; new_code: string };
    description: string;
  },
  suggestionType: string,
): string {
  const basePrompt = `CodeRabbit ${suggestionType} suggestion for ${item.file_path}:${item.line_range}`;

  if (item.code_suggestion) {
    return `${basePrompt}
    
Current code:
\`\`\`typescript
${item.code_suggestion.old_code}
\`\`\`

Suggested change:
\`\`\`typescript
${item.code_suggestion.new_code}
\`\`\`

Context: ${item.description}
Priority: ${suggestionType === "nit" ? "Low" : "Medium"}
Effort: Quick fix (1-2 minutes)`;
  }

  return `${basePrompt}
  
Description: ${item.description}
Priority: ${suggestionType === "nit" ? "Low" : "Medium"}`;
}

/**
 * Infer category from suggestion description using keyword analysis.
 *
 * Analyzes the suggestion description text to categorize the type of
 * issue being addressed. This helps with prioritization and filtering.
 *
 * ## Category Detection
 *
 * Uses keyword matching to identify:
 * - **Security**: vulnerability, security, exploit, injection
 * - **Performance**: performance, slow, optimize, bottleneck
 * - **Style**: style, format, lint, prettier, eslint
 * - **Bug**: error, exception, bug, crash, fail
 * - **General**: fallback for uncategorized items
 *
 * @param description - Suggestion description text to analyze
 * @returns Categorized type string
 */
function inferCategory(description: string): string {
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes("security") || lowerDesc.includes("vulnerability"))
    return "security";
  if (
    lowerDesc.includes("performance") ||
    lowerDesc.includes("slow") ||
    lowerDesc.includes("optimize")
  )
    return "performance";
  if (
    lowerDesc.includes("style") ||
    lowerDesc.includes("format") ||
    lowerDesc.includes("lint")
  )
    return "style";
  if (
    lowerDesc.includes("error") ||
    lowerDesc.includes("exception") ||
    lowerDesc.includes("bug")
  )
    return "bug";
  return "general";
}

/**
 * Apply CodeRabbit-specific filtering and sorting to comments.
 *
 * This function implements the final processing pipeline for CodeRabbit
 * comments, applying user-specified filtering and sorting options.
 *
 * ## Filtering Options
 *
 * - **Type Filtering**: Include/exclude specific suggestion types
 * - **Boolean Filters**: Control inclusion of nits, duplicates, additional
 * - **Actionable Priority**: Always include actionable items regardless of filters
 *
 * ## Sorting Options
 *
 * - **Priority Sorting**: Sort actionable items first
 * - **Type Grouping**: Group comments by suggestion type
 * - **File Ordering**: Within groups, sort by file path alphabetically
 *
 * ## Processing Pipeline
 *
 * 1. **Type Filtering**: Apply suggestion_type filters
 * 2. **Boolean Filtering**: Apply include_nits, include_duplicates, etc.
 * 3. **Priority Sorting**: Move actionable items to top if requested
 * 4. **Type Grouping**: Group by suggestion type if requested
 * 5. **File Sorting**: Sort by file path within groups
 *
 * @param comments - Array of CodeRabbit comments to process
 * @param options - CodeRabbit filtering and sorting options
 * @returns Filtered and sorted array of comments
 */
function applyCodeRabbitFiltering(
  comments: Comment[],
  options: CodeRabbitOptions,
): Comment[] {
  let filtered = comments;

  // Filter CodeRabbit comments based on options
  filtered = filtered.filter((comment) => {
    if (!comment.coderabbit_metadata) return true; // Keep non-CodeRabbit comments

    const { suggestion_type } = comment.coderabbit_metadata;

    // Apply type-based filtering
    if (
      options.suggestion_types &&
      !options.suggestion_types.includes(suggestion_type)
    ) {
      return false;
    }

    // Apply boolean filters
    switch (suggestion_type) {
      case "nit":
        return options.include_nits !== false;
      case "duplicate":
        return options.include_duplicates !== false;
      case "additional":
        return options.include_additional !== false;
      case "actionable":
        return true; // Always include actionable items
    }

    return true;
  });

  // Apply prioritization if requested
  if (options.prioritize_actionable) {
    filtered.sort((a, b) => {
      const aIsActionable =
        a.coderabbit_metadata?.suggestion_type === "actionable";
      const bIsActionable =
        b.coderabbit_metadata?.suggestion_type === "actionable";

      if (aIsActionable && !bIsActionable) return -1;
      if (!aIsActionable && bIsActionable) return 1;
      return 0;
    });
  }

  // Apply grouping if requested
  if (options.group_by_type) {
    filtered.sort((a, b) => {
      const aType = a.coderabbit_metadata?.suggestion_type || "other";
      const bType = b.coderabbit_metadata?.suggestion_type || "other";

      // Group by type, with actionable first
      const typeOrder: Record<string, number> = {
        actionable: 0,
        nit: 1,
        duplicate: 2,
        additional: 3,
        other: 4,
      };
      const aOrder = typeOrder[aType] ?? 4;
      const bOrder = typeOrder[bType] ?? 4;

      if (aOrder !== bOrder) return aOrder - bOrder;

      // Within same type, sort by file path
      const aFile = a.file_path || "";
      const bFile = b.file_path || "";
      return aFile.localeCompare(bFile);
    });
  }

  return filtered;
}
