# CodeRabbit Nits Parsing Design

## Overview

Enhance the `find_unresolved_comments` tool to better parse and categorize CodeRabbit's "prompt for agents" structured feedback, particularly focusing on "nits" (minor suggestions) and other categorized feedback types.

## Problem Statement

Current CodeRabbit parsing in `find_unresolved_comments` extracts actionable comments from review bodies but doesn't leverage CodeRabbit's structured "prompt for agents" format that provides:

1. **Categorized feedback** (nits, duplicates, additional comments)
2. **Structured metadata** (file paths, line numbers, severity)
3. **Agent-friendly formatting** with clear sections and actionable items

## CodeRabbit Review Structure Analysis

Based on examination of real CodeRabbit reviews, the structure includes:

### Main Sections
- `🧹 Nitpick comments (N)` - Minor suggestions, style improvements
- `♻️ Duplicate comments` - Issues already mentioned elsewhere  
- `📜 Review details` - Metadata and configuration info
- `🔇 Additional comments` - Supplementary feedback
- `Actionable comments posted: N` - Summary of actionable items

### "Prompt for Agents" Feature

CodeRabbit's "prompt for agents" feature provides structured, AI-agent-friendly feedback including:

1. **Structured Action Items**: Each suggestion includes:
   - File path and line numbers
   - Specific code suggestions with diffs
   - Severity indicators (implicit in section type)
   - Actionable next steps

2. **Agent-Friendly Formatting**: 
   - Clear categorization (nits vs actionable vs duplicates)
   - Code blocks with specific changes
   - File context and line references
   - Structured metadata for decision-making

3. **Implementation Guidance**:
   - Specific code changes with before/after examples
   - File paths and line numbers for precise targeting
   - Context about why changes are suggested
   - Priority indicators through section organization

### Individual Comment Structure
Each CodeRabbit suggestion follows a structured format with:
- File path and line number in the summary
- Clear suggestion title
- Code diffs showing before/after changes
- Context about why the change is suggested

## Design Goals

1. **Leverage CodeRabbit's "prompt for agents" structure** for better categorization
2. **Filter by suggestion type** (nits vs actionable vs duplicates)
3. **Preserve structured metadata** (file paths, line numbers, severity)
4. **Maintain backward compatibility** with existing parsing
5. **Provide agent-friendly filtering options**
6. **Extract agent prompts** from CodeRabbit's structured feedback for AI agent consumption
7. **Enhance action commands** with CodeRabbit-specific context and implementation guidance

## Proposed Schema Changes

### Input Parameters
Add an optional `coderabbit_options` object to group all CodeRabbit-specific configuration:

```typescript
coderabbit_options?: {
  include_nits?: boolean;           // 💾 User preference: Include minor suggestions (default: true)
  include_duplicates?: boolean;      // 💾 User preference: Include duplicate suggestions (default: true)  
  include_additional?: boolean;      // 💾 User preference: Include additional comments (default: true)
  suggestion_types?: string[];       // Filter by specific suggestion types (optional)
  prioritize_actionable?: boolean;  // 💾 User preference: Show actionable items first (default: false)
  group_by_type?: boolean;          // 💾 User preference: Group comments by suggestion type (default: false)
  extract_agent_prompts?: boolean;  // 💾 User preference: Generate agent-friendly prompts (default: true)
}
```

This approach:
- **Follows existing patterns**: Optional booleans with defaults, just like `include_bots`
- **Preference hints**: Uses 💾 emoji to indicate user preferences worth remembering
- **Clean separation**: Groups CodeRabbit functionality together
- **Progressive enhancement**: Users can start with defaults and customize as needed
- **Agent-friendly**: AI agents can learn and remember user preferences

### Enhanced Comment Interface
Extend the existing Comment interface with CodeRabbit-specific metadata:
- `suggestion_type`: Categorization (nit, duplicate, additional, actionable)
- `severity`: Priority level (low, medium, high)
- `category`: Type of issue (style, performance, security, etc.)
- `file_context`: File path and line numbers
- `code_suggestion`: Before/after code examples
- `agent_prompt`: Structured prompt for AI agents
- `implementation_guidance`: Priority, effort estimates, dependencies, rationale

## Parsing Logic Design

### 1. Enhanced CodeRabbit Parser
Parse CodeRabbit review bodies to extract structured sections:
- Detect and categorize different section types (nitpick, duplicate, additional, actionable)
- Extract individual suggestions with file context and code changes
- Generate agent-friendly prompts with implementation guidance
- Preserve existing parsing logic for backward compatibility

### 2. Section Parser
Parse CodeRabbit's structured sections:
- **Nitpick sections**: Minor suggestions and style improvements
- **Duplicate sections**: Issues already mentioned elsewhere
- **Additional sections**: Supplementary feedback and context
- **Actionable sections**: Critical issues requiring immediate attention

Each section contains:
- File path and line number references
- Suggestion titles and descriptions
- Code diffs with before/after examples
- Context about why changes are suggested

### 3. Agent Prompt Extraction
Transform CodeRabbit suggestions into AI-agent-friendly prompts:
- Include file context and line numbers for precise targeting
- Provide code examples with before/after changes
- Add priority indicators and effort estimates
- Include rationale for why changes are suggested
- Structure prompts for easy agent consumption

### 4. Filtering Logic
Apply user-specified filters to CodeRabbit suggestions:
- Filter by suggestion type (nits, duplicates, additional, actionable)
- Apply boolean toggles for different categories
- Support agent preferences for organization and prioritization
- Maintain backward compatibility with existing filtering

## Implementation Plan

### Phase 1: Enhanced Parsing
1. **Update schema** with CodeRabbit-specific parameters
2. **Enhance CodeRabbit parser** to detect and categorize sections
3. **Add metadata extraction** for suggestion types and severity
4. **Maintain backward compatibility** with existing parsing

### Phase 2: Filtering & Grouping
1. **Implement filtering logic** for suggestion types
2. **Add grouping options** for agent-friendly organization
3. **Enhance action commands** with CodeRabbit-specific context
4. **Add preference hints** for AI agents

### Phase 3: Testing & Documentation
1. **Test with real CodeRabbit reviews** from the repository
2. **Add comprehensive test cases** for different suggestion types
3. **Update documentation** with usage examples
4. **Create agent guidance** for leveraging structured feedback

## Usage Examples

### Basic Usage (Current Behavior)
Existing usage continues to work without changes - no CodeRabbit options needed.

### Basic CodeRabbit Integration
Enable CodeRabbit parsing with default settings (all options use defaults):
```json
{
  "pr": "owner/repo#123",
  "parse_review_bodies": true,
  "coderabbit_options": {}
}
```

### Customize Specific Preferences
Override only the preferences you care about:
```json
{
  "pr": "owner/repo#123",
  "coderabbit_options": {
    "include_duplicates": false,  // Skip duplicates, keep other defaults
    "prioritize_actionable": true // Show actionable items first
  }
}
```

### Agent-Friendly Processing
Optimize for AI agent consumption with specific preferences:
```json
{
  "pr": "owner/repo#123",
  "coderabbit_options": {
    "group_by_type": true,        // Group by suggestion type
    "extract_agent_prompts": true // Generate agent-friendly prompts
  }
}
```

### Advanced Filtering
Combine type filtering with user preferences:
```json
{
  "pr": "owner/repo#123",
  "coderabbit_options": {
    "suggestion_types": ["actionable", "nit"], // Filter to specific types
    "include_duplicates": false,               // Skip duplicates
    "prioritize_actionable": true             // Show actionable first
  }
}
```

## Benefits

1. **Better Agent Integration**: Leverages CodeRabbit's "prompt for agents" structure
2. **Improved Filtering**: Agents can focus on specific types of feedback
3. **Enhanced Metadata**: Rich context for AI decision-making
4. **Backward Compatibility**: Existing usage continues to work
5. **Flexible Configuration**: Supports different agent preferences and workflows

## Considerations

1. **Performance**: Additional parsing overhead for structured content
2. **Complexity**: More parameters and filtering logic
3. **Maintenance**: Need to keep up with CodeRabbit format changes
4. **Testing**: Requires real CodeRabbit review data for comprehensive testing

## Next Steps

1. **Review and refine** this design based on feedback
2. **Implement Phase 1** (enhanced parsing)
3. **Test with real data** from repository PRs
4. **Iterate based on results** and agent feedback
5. **Document usage patterns** and best practices
