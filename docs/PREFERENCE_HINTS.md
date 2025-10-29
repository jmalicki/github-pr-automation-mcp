# User Preference Hints for AI Agents

## Overview

Tool schemas can include metadata hints to help AI agents identify which parameters are likely user preferences worth remembering, vs. situational parameters that change each invocation.

## Schema Annotations

### In Tool Descriptions (MCP Standard)

```typescript
// MCP tool registration
{
  name: "get_failing_tests",
  description: "Analyze PR CI failures and provide fix instructions",
  inputSchema: {
    type: "object",
    required: ["pr"],  // Only PR is required
    properties: {
      pr: {
        type: "string",
        description: "PR identifier (owner/repo#123)"
      },
      wait: {
        type: "boolean",
        description: "Wait for CI completion (default: false)",
        default: false
      },
      bail_on_first: {
        type: "boolean",
        description: "Stop at first failure when waiting. " +
                     "💾 User preference: Some users prefer fast feedback, " +
                     "others want to see all failures at once. " +
                     "(default: true, overridden by user preference if set)",
        default: true
      },
      page_size: {
        type: "number",
        description: "Results per page. " +
                     "💾 User preference: Power users often prefer larger pages. " +
                     "(default: 10, overridden by user preference if set)",
        default: 10,
        minimum: 1,
        maximum: 50
      }
    }
  }
}

// Zod schema with optional preference-worthy params
export const GetFailingTestsSchema = z.object({
  pr: z.string(),
  wait: z.boolean().optional().default(false),
  bail_on_first: z.boolean().optional(),  // Optional - allows 3-level precedence
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(50).optional()  // Optional
});
```

```

### Preference Hint Convention

Use the 💾 emoji or "User preference:" prefix in descriptions to signal:

**This parameter is likely a personal preference worth remembering**

## Examples by Tool

### get_failing_tests

| Parameter | Type | Preference? | Reasoning |
|-----------|------|-------------|-----------|
| `pr` | string | ❌ No | Changes every call |
| `wait` | boolean | ⚠️ Maybe | Depends on urgency |
| `bail_on_first` | boolean | ✅ Yes | Workflow preference |
| `page` | number | ❌ No | Pagination state |
| `page_size` | number | ✅ Yes | Display preference |

### find_unresolved_comments

| Parameter | Type | Preference? | Reasoning |
|-----------|------|-------------|-----------|
| `pr` | string | ❌ No | Changes every call |
| `include_bots` | boolean | ✅ Yes | Strong preference |
| `exclude_authors` | array | ⚠️ Maybe | May vary by project |
| `page` | number | ❌ No | Pagination state |
| `page_size` | number | ✅ Yes | Display preference |
| `sort` | enum | ✅ Yes | Workflow preference |

### manage_stacked_prs

| Parameter | Type | Preference? | Reasoning |
|-----------|------|-------------|-----------|
| `base_pr` | string | ❌ No | Situational |
| `dependent_pr` | string | ❌ No | Situational |
| `auto_fix` | boolean | ✅ Yes | Trust level preference |
| `use_onto` | boolean | ⚠️ Maybe | Some always want it |
| `page_size` | number | ✅ Yes | Display preference |

### rebase_after_squash_merge

| Parameter | Type | Preference? | Reasoning |
|-----------|------|-------------|-----------|
| `pr` | string | ❌ No | Situational |
| `upstream_pr` | string | ❌ No | Situational |
| `target_branch` | string | ⚠️ Maybe | Often "main" |

## AI Agent Behavior

### On First Use

```

User: "Get failing tests for owner/repo#123"
AI: Uses default bail_on_first: true

AI: "I found 1 failing test. (Note: I stopped at the first failure.
     If you prefer to see all failures at once, let me know!)"

```

### Learning Preference

```

User: "No, show me all failures"
AI: Calls again with bail_on_first: false
AI: *stores in memory* "User prefers bail_on_first: false"

Later...
User: "Get failing tests for owner/repo#456"
AI: *remembers* Uses bail_on_first: false automatically
AI: "Found 5 failing tests (showing all failures as you prefer)"

```

### Confirming Preference

```

AI: "I notice you've set include_bots: false the last 3 times.
     Would you like me to always exclude bot comments by default?"

User: "Yes"
AI: *stores as strong preference*

```

## Response Hints

Tools can also return hints in responses:

```typescript
{
  "status": "failed",
  "failures": [...],
  "preferences_detected": {
    "bail_on_first": {
      "current_value": true,
      "hint": "You used bail_on_first=true. This is typically a user preference.",
      "alternatives": ["Set to false to see all failures at once"]
    }
  }
}
```

## Implementation in Tool Handlers

### Schema Definition

```typescript
export const GetFailingTestsSchema = z.object({
  pr: z.string()
    .describe("PR identifier (owner/repo#123)"),
  
  wait: z.boolean()
    .default(false)
    .describe("Wait for CI completion"),
  
  bail_on_first: z.boolean()
    .default(true)
    .describe(
      "Stop at first failure when waiting. " +
      "💾 User preference: Fast feedback vs. complete results"
    ),
  
  page_size: z.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe(
      "Results per page. " +
      "💾 User preference: Power users often prefer 20-50"
    )
});

// Metadata for AI agents
export const GetFailingTestsMetadata = {
  preferenceHints: {
    bail_on_first: {
      type: "workflow",
      description: "User's preferred failure reporting style",
      learnFrom: "repeated_usage"
    },
    page_size: {
      type: "display",
      description: "User's preferred result pagination size",
      learnFrom: "repeated_usage"
    }
  }
};
```

## Parameter Precedence (3-Level System)

**What user preferences do**: Override tool defaults for optional arguments ONLY.

**Precedence order** (highest to lowest):

1. **Explicit argument from LLM/agent** - ALWAYS WINS, no exceptions
2. **User preference** - Overrides tool default for optional arguments
3. **Tool default** - Base fallback

**Critical rules**:

- ✅ Preferences override **tool defaults** for optional parameters
- ❌ Preferences NEVER override **explicit arguments** from LLM/agent
- 💡 Think of preferences as "better defaults" that the LLM can still override

### Implementation

```typescript
function resolveParameterValue<T>(
  paramName: string,
  explicitValue: T | undefined,  // What LLM/agent provided
  userPreferences: Record<string, any>,
  toolDefault: T
): T {
  // 1. Explicit argument from LLM/agent ALWAYS wins
  if (explicitValue !== undefined) {
    return explicitValue;  // LLM said so, use it!
  }
  
  // 2. No explicit argument? Check user preference
  //    (This is where preference overrides the default)
  if (paramName in userPreferences) {
    return userPreferences[paramName];  // User's "better default"
  }
  
  // 3. No explicit arg, no preference? Use tool default
  return toolDefault;
}

// Usage in tool handler
export async function handleGetFailingTests(args: GetFailingTestsInput) {
  const prefs = await loadUserPreferences('get_failing_tests');
  
  const effectiveArgs = {
    pr: args.pr,  // Required, no default
    wait: args.wait ?? false,  // No preference support
    bail_on_first: resolveParameterValue(
      'bail_on_first',
      args.bail_on_first,  // undefined if not provided
      prefs,
      true  // tool default
    ),
    page_size: resolveParameterValue(
      'page_size',
      args.page_size,
      prefs,
      10  // tool default
    )
  };
  
  // ... use effectiveArgs
}
```

## Config File Support (Optional)

```json
// ~/.resolve-pr-mcp/preferences.json
{
  "version": "1.0",
  "preferences": {
    "get_failing_tests": {
      "bail_on_first": false,  // User prefers seeing all failures
      "page_size": 20          // User prefers larger pages
    },
    "find_unresolved_comments": {
      "include_bots": false,   // User filters out bots
      "sort": "by_file"        // User prefers file-based sorting
    }
  },
  "learned_from": "AI agent suggestions",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

## Example Scenarios

### Scenario 1: No preference, use default

```typescript
// User call
get_failing_tests({ pr: "owner/repo#123" })

// No bail_on_first provided, no preference stored
// Result: Uses tool default (true)
effectiveArgs.bail_on_first === true
```

### Scenario 2: Preference exists, use it

```typescript
// User call
get_failing_tests({ pr: "owner/repo#123" })

// No bail_on_first provided, but preference exists
// Preference: { "bail_on_first": false }
// Result: Uses user preference (false)
effectiveArgs.bail_on_first === false
```

### Scenario 3: Explicit argument from LLM overrides preference

```typescript
// LLM/agent call (explicit argument provided)
get_failing_tests({ 
  pr: "owner/repo#123",
  bail_on_first: true  // LLM explicitly said true
})

// User's stored preference: { "bail_on_first": false }
// Result: LLM's explicit argument wins (true)
//         Preference is ignored because LLM was explicit
effectiveArgs.bail_on_first === true
```

### Scenario 4: LLM can situationally override preference

```typescript
// User's stored preference: bail_on_first = false (see all failures)

// But LLM decides this time user wants quick feedback
get_failing_tests({ 
  pr: "owner/repo#123",
  bail_on_first: true  // LLM explicitly overrides preference
})
// Result: true (LLM's explicit choice)

// Next time, LLM omits the argument (lets preference apply)
get_failing_tests({ pr: "owner/repo#456" })
// No explicit bail_on_first provided
// Result: false (user's preference)
```

## Example: Complete Flow

### 1. First Interaction

```
User: "Check PR #123 for failing tests"
AI: Uses defaults (bail_on_first: true, page_size: 10)
```

### 2. User Correction

```
User: "Show all failures, not just the first"
AI: Learns bail_on_first: false preference
AI: *stores in conversation memory*
```

### 3. Pattern Recognition

```
AI: After 3 uses with same preference
AI: "I notice you prefer seeing all test failures at once. 
     Should I make this your default?"
```

### 4. Automatic Application

```
User: "Check PR #456 for failing tests"
AI: *applies remembered preference*
AI: Uses bail_on_first: false automatically
AI: "Checking all failures (as you prefer)..."
```

### 5. Situational Override

```
User: "Quick check on PR #789, just show first failure"
AI: *recognizes situational override*
AI: Uses bail_on_first: true this once
AI: "Using fast mode for this check..."
```

## Benefits

1. **AI learns naturally** from user corrections
2. **No database required** - preferences in conversation memory or simple file
3. **Always overridable** - situational needs trump preferences
4. **Clear signals** - 💾 emoji makes it obvious to both AI and users
5. **Self-documenting** - hints explain why something is preference-worthy

## Guideline: What Makes a Good Preference Hint?

### ✅ Good Preference Candidates

- **Workflow style**: Fast vs. thorough (`bail_on_first`)
- **Display preferences**: Pagination sizes
- **Noise tolerance**: Include/exclude bot comments
- **Trust level**: Auto-fix vs. manual review
- **Format preferences**: JSON vs. human-readable

### ❌ Not Preference Candidates

- **Context-specific**: PR identifiers, branch names
- **State**: Page numbers, cursors
- **One-time**: Special flags for specific situations
- **Variable by project**: Might change per repo

### ⚠️ Maybe Preferences

- **Common patterns**: Target branch (often "main" but not always)
- **Project-specific**: Reviewer preferences
- **Frequency-dependent**: Things used rarely

## Summary

**What user preferences are**:

- Better defaults that override tool defaults
- Apply ONLY to optional parameters
- Apply ONLY when LLM doesn't provide explicit argument

**What user preferences are NOT**:

- Not overrides for explicit LLM arguments
- Not mandatory settings
- Not stored server-side (just local config file)

**Implementation**:

- Add 💾 emoji to mark preference-worthy parameters
- AI agents learn and store preferences
- Simple config file (optional)
- Explicit LLM arguments ALWAYS win
- Keeps MCP server stateless
