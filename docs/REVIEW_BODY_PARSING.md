# Review Body Parsing Feature

## Overview

The `find_unresolved_comments` tool now supports parsing review bodies to extract actionable comments from AI-driven review tools like CodeRabbit. This feature addresses a significant gap in comment detection that was causing users to miss important feedback.

## Why This Feature Was Necessary

### The Problem

Traditional GitHub PR comments come in three types:
1. **Review Comments** - Line-specific comments on code changes
2. **Issue Comments** - General PR discussion comments  
3. **Review Bodies** - The main text content of a review submission

The original `find_unresolved_comments` tool only captured the first two types, missing actionable feedback embedded within review bodies. This was particularly problematic with AI review tools like CodeRabbit, which structure their feedback differently.

### CodeRabbit's Unique Approach

CodeRabbit differs from traditional human reviewers in several key ways:

#### 1. **Structured Review Bodies**
Instead of creating separate review comments for each issue, CodeRabbit embeds multiple actionable suggestions within a single review body using structured markup:

```markdown
**Actionable comments posted: 0**

<details>
<summary>🧹 Nitpick comments (1)</summary>
<blockquote>

<details>
<summary>scripts/install-cli.js (1)</summary>
<blockquote>

`36-41`: **Consider copying the lockfile for reproducible builds.**

While the current approach works, copying only `package.json` without the lockfile means the standalone installation might pull different dependency versions.

If reproducibility is important, add lockfile copying after line 37:

```diff
 // Copy package.json for dependencies
 copyFileSync('package.json', join(standaloneDir, 'package.json'));

+// Copy lockfile for reproducible builds
+const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
+for (const lockFile of lockFiles) {
+  if (existsSync(lockFile)) {
+    copyFileSync(lockFile, join(standaloneDir, lockFile));
+    break;
+  }
+}
```

</blockquote>
</details>

</blockquote>
</details>
```

#### 2. **File Context and Line Ranges**
CodeRabbit uses specific markup patterns to indicate:
- **File context**: `<summary>filename (n)</summary>` or `filename (n)`
- **Line ranges**: `36-41`: **suggestion text** or `36`: **suggestion text**
- **Code suggestions**: Embedded diff blocks with specific formatting

#### 3. **Batch Processing**
Unlike human reviewers who create individual comments, CodeRabbit processes multiple files and issues in a single review, then presents them as a structured summary.

## How the Feature Works

### Parsing Logic

The feature uses sophisticated regex patterns to extract actionable content:

```typescript
// File context detection
const fileMatch =
  line.match(/^<summary>\s*`?([^<`]+?)`?\s*\((\d+)\)\s*<\/summary>/i) ||
  line.match(/^\s*`?([^<`]+?)`?\s*\((\d+)\)\s*$/);

// Line range and suggestion detection  
const lineRangeMatch = line.match(/^(?:`)?(\d+(?:-\d+)?)`?:\s*\*\*(.*?)\*\*/);
```

### Code Block Handling

The parser intelligently captures code suggestions while avoiding leakage between different suggestions:

```typescript
// Local code block state per suggestion
let inCodeBlock = false;
for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
  const nextLine = lines[j];
  if (nextLine.startsWith('```diff') || nextLine.startsWith('```')) {
    inCodeBlock = true;
    suggestionBody += '\n\n' + nextLine;
  } else if (inCodeBlock) {
    suggestionBody += '\n' + nextLine;
    if (nextLine.startsWith('```')) {
      inCodeBlock = false;
      break;
    }
  }
  // Handle terminators like <summary> tags
  else if (nextLine.startsWith('<summary>')) {
    break;
  }
}
```

### Pagination Support

The feature properly handles pagination for review bodies, ensuring all actionable comments are captured across multiple pages:

```typescript
// Track reviews pagination
let hasMoreReviews = false;
if (input.parse_review_bodies) {
  const reviewsResponse = await octokit.pulls.listReviews({...});
  hasMoreReviews = reviewsResponse.headers.link?.includes('rel="next"') ?? false;
}

// Include in overall pagination logic
const hasMore = hasMoreReviewComments || hasMoreIssueComments || hasMoreReviews;
```

## Usage

### Basic Usage

```typescript
const result = await handleFindUnresolvedComments(client, {
  pr: 'owner/repo#123',
  parse_review_bodies: true  // Default: true
});
```

### Disabling Review Body Parsing

```typescript
const result = await handleFindUnresolvedComments(client, {
  pr: 'owner/repo#123',
  parse_review_bodies: false  // Skip review body parsing
});
```

## Output Format

Parsed review body comments are returned as standard `Comment` objects with:

```typescript
{
  id: number,
  type: 'review',
  author: 'coderabbitai[bot]',
  author_association: 'CONTRIBUTOR',
  is_bot: true,
  file_path: 'scripts/install-cli.js',
  line_number: 36,
  body: 'Consider copying the lockfile for reproducible builds.\n\n```diff\n...',
  html_url: 'https://github.com/owner/repo/pull/123#pullrequestreview-456',
  action_commands: {
    reply_command: 'gh pr comment 123 --repo owner/repo --body "YOUR_RESPONSE_HERE"',
    resolve_command: 'gh api -X POST /repos/owner/repo/pulls/123/comments/456/replies -f body="✅ Fixed"',
    resolve_condition: 'Run ONLY after you\'ve verified the fix',
    view_in_browser: 'gh pr view 123 --repo owner/repo --web'
  }
}
```

## Benefits

### 1. **Complete Comment Coverage**
- Captures all actionable feedback, not just traditional comments
- Ensures no important suggestions are missed
- Provides unified view of all PR feedback

### 2. **AI Tool Integration**
- Seamlessly works with CodeRabbit and other AI review tools
- Extracts structured suggestions from complex review bodies
- Maintains context and file/line associations

### 3. **Backward Compatibility**
- Existing functionality unchanged
- Can be disabled if not needed
- No breaking changes to API

### 4. **Enhanced Developer Experience**
- Developers see all feedback in one place
- Actionable suggestions are properly categorized
- Easy to track and resolve issues

## Future Extensibility

The parsing framework is designed to be extensible:

```typescript
// Current: CodeRabbit support
const codeRabbitComments = parseCodeRabbitReviewBody(body, review, pr, author, authorAssociation, isBot);

// Future: Additional AI tools
// const copilotComments = parseCopilotReviewBody(body, review, pr, author, authorAssociation, isBot);
// const sonarComments = parseSonarReviewBody(body, review, pr, author, authorAssociation, isBot);
```

## Technical Implementation

### Schema Changes

```typescript
export const FindUnresolvedCommentsSchema = z.object({
  pr: PRIdentifierStringSchema,
  include_bots: z.boolean().default(true),
  exclude_authors: z.array(z.string()).optional(),
  cursor: z.string().optional(),
  sort: z.enum(['chronological', 'by_file', 'by_author']).default('chronological'),
  parse_review_bodies: z.boolean().default(true) // New parameter
});
```

### Handler Integration

```typescript
// Fetch reviews to parse for actionable comments
let reviewBodiesComments: Comment[] = [];
let hasMoreReviews = false;
if (input.parse_review_bodies) {
  const reviewsResponse = await octokit.pulls.listReviews({...});
  reviewBodiesComments = parseReviewBodiesForActionableComments(reviewsResponse.data, pr);
  hasMoreReviews = reviewsResponse.headers.link?.includes('rel="next"') ?? false;
}

// Combine all comment types
const allComments: Comment[] = [
  ...reviewBodiesComments,        // Parsed from review bodies
  ...reviewCommentsResponse.data.map(c => ({...})),  // Traditional review comments
  ...issueCommentsResponse.data.map(c => ({...}))    // Issue comments
];
```

## Testing

The feature includes comprehensive test coverage:

- **Unit tests**: Parser logic with various CodeRabbit formats
- **Integration tests**: End-to-end functionality with mocked GitHub API
- **Edge cases**: Malformed markup, missing context, pagination
- **Backward compatibility**: Existing functionality unchanged

## Conclusion

This feature bridges the gap between traditional GitHub comment detection and modern AI-driven code review tools. By parsing structured review bodies, it ensures that all actionable feedback is captured and presented in a unified, actionable format. This is essential for teams using AI review tools like CodeRabbit, as it prevents important suggestions from being overlooked in the review process.
