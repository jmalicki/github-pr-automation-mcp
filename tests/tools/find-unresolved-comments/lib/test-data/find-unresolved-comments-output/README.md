# Find Unresolved Comments Output Test Data

This directory contains test data for the `find-unresolved-comments` tool output.

## Files

- **`pr-65-output.json`**: The complete JSON output from running `find-unresolved-comments` on PR #65 (jmalicki/github-pr-automation-mcp#65)
- **`comments-summary.json`**: Overview of all comments with metadata and filenames
- **`comment-{id}.json`**: Individual comment files (one per comment from the comments array)
- **`annotation-expected.json`**: Manual annotation file indicating which comments should be included/filtered

## Purpose

This test data allows us to:
1. Verify that the `find-unresolved-comments` tool produces the expected output format
2. Test filtering logic by comparing actual output against manual annotations
3. Ensure that CodeRabbit comments with large base64 internal state are properly filtered out

## Usage

The files are organized as follows:

- **`pr-65-output.json`**: Complete output with pretty-printed JSON and multi-line strings
- **`comments-summary.json`**: Quick overview of all comments with metadata
- **`comment-{id}.json`**: Individual comment files for easy review (one per comment)
- **`annotation-expected.json`**: Manual annotations for each comment ID

The `annotation-expected.json` file contains:
- Manual annotations for each comment ID
- `should_include`: boolean indicating if the comment should be in the final output
- `reason`: brief explanation of why the comment should/shouldn't be included
- `bugs`: description of any issues found in the test data output (null if no issues)

## Important Notes

⚠️ **DO NOT EDIT `annotation-expected.json` WITH AI AGENTS** ⚠️

This file is for manual annotation only. AI agents should not modify this file. Only human reviewers should edit the `should_include` values.

## Test Case: PR #65

This specific PR was chosen because it contains:
- Multiple actionable CodeRabbit review comments (should be included)
- One CodeRabbit issue comment with large base64 internal state (should be filtered out)

The filtering fix ensures that the issue comment with 7807-character base64 string is properly excluded from the output.
