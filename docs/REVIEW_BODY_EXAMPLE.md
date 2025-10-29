# Review Body Parsing Example

## The Problem

CodeRabbit and other AI review tools structure their feedback differently than traditional human reviewers. Instead of creating individual review comments, they embed multiple actionable suggestions within a single review body using structured markup.

## Before: Missing Actionable Comments

Without review body parsing, this CodeRabbit feedback would be completely missed:

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

## After: Extracted Actionable Comments

With review body parsing enabled, the tool extracts this as a structured comment:

```json
{
  "id": 123456789,
  "type": "review",
  "author": "coderabbitai[bot]",
  "author_association": "CONTRIBUTOR",
  "is_bot": true,
  "file_path": "scripts/install-cli.js",
  "line_number": 36,
  "body": "Consider copying the lockfile for reproducible builds.\n\nWhile the current approach works, copying only `package.json` without the lockfile means the standalone installation might pull different dependency versions.\n\nIf reproducibility is important, add lockfile copying after line 37:\n\n```diff\n // Copy package.json for dependencies\n copyFileSync('package.json', join(standaloneDir, 'package.json'));\n+\n+// Copy lockfile for reproducible builds\n+const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];\n+for (const lockFile of lockFiles) {\n+  if (existsSync(lockFile)) {\n+    copyFileSync(lockFile, join(standaloneDir, lockFile));\n+    break;\n+  }\n+}\n```",
  "html_url": "https://github.com/owner/repo/pull/123#pullrequestreview-456",
  "action_commands": {
    "reply_command": "gh pr comment 123 --repo owner/repo --body \"YOUR_RESPONSE_HERE\"",
    "resolve_command": "gh api -X POST /repos/owner/repo/pulls/123/comments/456/replies -f body=\"✅ Fixed\"",
    "resolve_condition": "Run ONLY after you've verified the fix for: 'Consider copying the lockfile for reproducible builds.'",
    "view_in_browser": "gh pr view 123 --repo owner/repo --web"
  }
}
```

## Usage

### Enable Review Body Parsing (Default)

```bash
# CLI usage
github-pr-automation find-unresolved-comments --pr "owner/repo#123"

# MCP usage
{
  "tool": "find_unresolved_comments",
  "arguments": {
    "pr": "owner/repo#123"
  }
}
```

### Disable Review Body Parsing

```bash
# CLI usage
github-pr-automation find-unresolved-comments --pr "owner/repo#123" --parse-review-bodies false

# MCP usage
{
  "tool": "find_unresolved_comments",
  "arguments": {
    "pr": "owner/repo#123",
    "parse_review_bodies": false
  }
}
```

## Why This Matters

### Traditional GitHub Comments

- **Review Comments**: Line-specific feedback on code changes
- **Issue Comments**: General PR discussion
- **Review Bodies**: Main review text (often ignored by tools)

### AI Review Tools (CodeRabbit, etc.)

- **Structured Feedback**: Multiple suggestions in single review body
- **File Context**: `<summary>filename (n)</summary>` format
- **Line Ranges**: `36-41`: **suggestion text** format
- **Code Suggestions**: Embedded diff blocks

### The Gap

Without review body parsing, AI-generated actionable suggestions are completely invisible to automated tools, causing important feedback to be missed.

## Benefits

1. **Complete Coverage**: Captures all actionable feedback, not just traditional comments
2. **AI Tool Integration**: Works seamlessly with CodeRabbit and other AI review tools
3. **Structured Data**: Extracts file context, line ranges, and suggestions
4. **Backward Compatible**: Can be disabled if not needed
5. **Unified View**: All feedback in one place for easy processing

## Technical Details

The parser uses sophisticated regex patterns to extract:

- **File Context**: `<summary>filename (n)</summary>` or `filename (n)`
- **Line Ranges**: `36-41`: **suggestion** or `36`: **suggestion**
- **Code Blocks**: Embedded diff suggestions with proper formatting
- **Context Preservation**: Maintains file/line associations for each suggestion

See [REVIEW_BODY_PARSING.md](./REVIEW_BODY_PARSING.md) for complete technical documentation.
