# Design Decisions

## Overview

This document captures key design decisions made during the development of the Resolve PR MCP server, along with the rationale behind each choice.

---

## 1. PR Identifier Format: Single String vs. Separate Fields

**Decision**: Use single string format `"owner/repo#123"` as the primary interface

**Alternatives Considered**:
- Separate fields: `{owner: string, repo: string, number: number}`
- URL only: `"https://github.com/owner/repo/pull/123"`

**Rationale**:
1. **AI Efficiency**: Single field reduces cognitive load for AI agents
2. **Human-Friendly**: Matches natural GitHub format (copy/paste from URLs)
3. **Flexibility**: Can support multiple formats with a parser:
   - `owner/repo#123` (concise)
   - `owner/repo/pulls/123` (explicit)
   - Full GitHub URLs
4. **Implementation**: Simple regex parsing handles all cases

**Implementation Note**:
```typescript
// Parser supports all formats:
parsePRIdentifier("owner/repo#123")
parsePRIdentifier("owner/repo/pulls/123")
parsePRIdentifier("https://github.com/owner/repo/pull/123")
// All return: {owner: "owner", repo: "repo", number: 123}
```

**Trade-offs**:
- ✅ More concise API
- ✅ Easier for humans and AI
- ❌ Requires parsing (minimal cost)
- ❌ Slight potential for edge cases (mitigated by validation)

---

## 2. Tool Responsibility: Data Provider vs. Analyzer

**Decision**: Tools provide **raw, structured data**; LLMs perform **analysis and categorization**

**Alternatives Considered**:
- Tools do full analysis (categorization, severity, response generation)
- Hybrid approach (tools suggest, LLM decides)

**Rationale**:

### Why Raw Data Approach?

1. **Separation of Concerns**
   - Tool: Fetch and structure data efficiently
   - LLM: Understand context and semantics

2. **LLM Strengths**
   - Better at understanding nuance ("This must be fixed" vs. "This could be better")
   - Can consider PR context (e.g., "breaking change" means different things in different contexts)
   - Adapts to project-specific terminology

3. **Tool Simplicity**
   - No need to maintain complex categorization rules
   - Easier to test (deterministic data fetching)
   - Less prone to false positives/negatives

4. **Flexibility**
   - Different LLMs might categorize differently
   - Users can customize LLM prompts without changing tools
   - Works across different project cultures

### Example: `find_unresolved_comments`

**Tool Provides**:
```typescript
{
  body: "This could lead to SQL injection",
  author: "senior-dev",
  author_association: "MEMBER",
  reactions: {"+1": 2, "eyes": 1},
  file_path: "src/db/users.ts"
}
```

**LLM Determines**:
- Category: "blocking" (security concern)
- Severity: "high" (SQL injection is critical)
- Priority: Address immediately
- Response: Generates appropriate fix

**If Tool Did This**:
```typescript
{
  body: "This could lead to SQL injection",
  category: "blocking",  // ❌ Pattern matching might miss context
  severity: "high",      // ❌ Might not understand project risk tolerance
  // What if comment says "This wouldn't lead to SQL injection because..."?
}
```

**Trade-offs**:
- ✅ More accurate categorization (LLM understands context)
- ✅ Simpler tool implementation
- ✅ Easier to maintain and test
- ✅ Flexible across projects
- ❌ LLM must do more work (but this is what LLMs are good at)

---

## 3. Bot Filtering: Default Include vs. Exclude

**Decision**: **Include bots by default** (`include_bots: true`)

**Alternatives Considered**:
- Exclude bots by default
- Prescriptive bot filtering (hardcoded bot list)

**Rationale**:

1. **Neutral Default**
   - Don't make assumptions about what users want to see
   - Bot comments (like CodeRabbit) can be valuable

2. **User Control**
   - LLM can filter based on content, not just username
   - `exclude_authors` parameter for explicit filtering
   - LLM can categorize as "nit" and deprioritize

3. **Context-Dependent Value**
   - In some contexts, bot nits are useful
   - In others, they're noise
   - LLM can decide based on prompt

**Example Usage**:
```typescript
// Default: include everything
find_unresolved_comments({pr: "owner/repo#123"})

// Explicit exclusion if desired
find_unresolved_comments({
  pr: "owner/repo#123",
  exclude_authors: ["coderabbitai", "github-actions"]
})

// Or let LLM filter:
"Show me unresolved comments, but ignore trivial style nits"
// LLM sees all comments, filters based on content
```

**Trade-offs**:
- ✅ More data for LLM to work with
- ✅ Flexible filtering
- ✅ No hidden assumptions
- ⚠️ More tokens consumed (but LLM can skim quickly)

---

## 4. Pagination: Mandatory vs. Optional

**Decision**: **Mandatory pagination** with sensible defaults

**Alternatives Considered**:
- Optional pagination (return all by default)
- No pagination (always return everything)

**Rationale**:

1. **Token Efficiency**
   - Large PRs can have 100+ comments or 50+ test failures
   - Returning everything wastes tokens and time

2. **Progressive Disclosure**
   - Users typically want to see "first 20 comments" not "all 500"
   - Can always request more pages

3. **Predictable Performance**
   - Bounded response sizes
   - Consistent latency

**Implementation**:
```typescript
// Defaults chosen based on typical usage
{
  page: 1,
  page_size: 10,  // For test failures (few items, detailed)
  page_size: 20,  // For comments (more items, scannable)
  page_size: 5,   // For commands (step-by-step)
}

// Always include pagination metadata
{
  pagination: {
    page: 1,
    total_pages: 5,
    has_next: true,
    has_previous: false
  }
}
```

**Trade-offs**:
- ✅ Predictable token usage
- ✅ Fast responses
- ✅ User can control detail level
- ❌ Might need multiple calls for full picture
- ❌ Slightly more complex API

---

## 5. Wait vs. Immediate: Polling Strategy

**Decision**: Support both modes with **`wait=false` as default**

**Rationale**:

1. **Immediate Mode (default)**
   - Fast response (< 2s)
   - Non-blocking
   - User can poll externally if needed

2. **Wait Mode (opt-in)**
   - Convenience for fix loops
   - `bail_on_first` for rapid feedback
   - Timeout protection (30 min max)

**Use Cases**:

**Immediate Mode**:
```typescript
// Quick status check
const status = await get_failing_tests({
  pr: "owner/repo#123",
  wait: false  // or omit (default)
});

if (status.status === "running") {
  // Come back later
}
```

**Wait Mode with Bail**:
```typescript
// Fast feedback loop
const result = await get_failing_tests({
  pr: "owner/repo#123",
  wait: true,
  bail_on_first: true  // Return ASAP when first failure detected
});
// Fix first failure, push, repeat
```

**Wait Mode Complete**:
```typescript
// Get all failures at once
const result = await get_failing_tests({
  pr: "owner/repo#123",
  wait: true,
  bail_on_first: false  // Wait for all tests
});
// Batch fix all failures
```

**Trade-offs**:
- ✅ Flexible for different workflows
- ✅ Fast by default
- ✅ Convenience when needed
- ❌ More complex implementation (polling logic)

---

## 6. Error Handling: Fail Fast vs. Graceful Degradation

**Decision**: **Fail fast for user errors**, **graceful degradation for API issues**

**Categories**:

1. **User Errors** (fail fast):
   - Invalid PR identifier → Clear error message with example
   - Missing token → "Set GITHUB_TOKEN environment variable"
   - Invalid parameters → Zod validation with specific field errors

2. **API Errors** (retry with backoff):
   - Rate limiting → Wait and retry automatically
   - Temporary unavailability → Exponential backoff
   - Timeouts → Retry 3 times

3. **Logical Errors** (explain and suggest):
   - PRs not stacked → "PR #124's base is 'main', not PR #123's head 'feature-x'"
   - No CI configured → "No CI checks found. Add GitHub Actions workflow?"
   - Empty results → "PR has no comments" (not an error)

**Example Error Response**:
```typescript
{
  error: "PR not found: owner/repo#123",
  category: "user",
  suggestion: "Check that PR number is correct. Example: 'owner/repo#456'",
  documentation_url: "https://github.com/..."
}
```

**Trade-offs**:
- ✅ Clear feedback for user mistakes
- ✅ Resilient to transient failures
- ✅ Actionable error messages
- ❌ More code complexity (error categorization)

---

## 7. Instruction Generation: Prescriptive vs. Descriptive

**Decision**: **Generate prescriptive, actionable instructions**

**Rationale**:

LLMs benefit from:
1. **Concrete next steps** rather than general observations
2. **Commands they can execute** rather than descriptions
3. **Prioritization** rather than flat lists

**Example: get_failing_tests**

**Instead of**:
```typescript
{
  message: "Tests failed in authentication module"
}
```

**We provide**:
```typescript
{
  instructions: {
    summary: "3 tests failed in authentication module",
    priority: [
      {
        test: "test_login",
        reason: "Blocking 5 downstream tests",
        suggested_fix: "Check JWT token validation - returns 500 instead of 401"
      }
    ],
    commands: [
      "pytest tests/auth/test_login.py -v",
      "pytest tests/auth/test_login.py::test_invalid_token -v"
    ]
  }
}
```

**Trade-offs**:
- ✅ Immediately actionable
- ✅ Clear priorities
- ✅ Reproducible locally
- ⚠️ Requires understanding test frameworks (but we do this anyway for parsing)

---

## 8. State Management: Stateless vs. Stateful

**Decision**: **Fully stateless** server

**Rationale**:

1. **Simplicity**
   - No session management
   - No cleanup required
   - Easy to reason about

2. **Reliability**
   - Server can restart without losing state
   - Each request is independent

3. **Scalability**
   - Easy to run multiple instances
   - No state synchronization

**Implications**:

- Each tool call is independent
- No memory of previous calls
- User/LLM maintains context
- Authentication via token each request

**Trade-offs**:
- ✅ Simple, reliable, scalable
- ✅ No stale state bugs
- ❌ Can't optimize across calls (but caching helps)
- ❌ No long-running operations tracking (use wait mode instead)

---

## 9. Response Format: Optimized for AI vs. Human

**Decision**: **Optimize for AI consumption** (but keep human-readable)

**Principles**:

1. **Structured over prose**
   ```typescript
   // ✅ Good (structured)
   {status: "failed", failure_count: 3}
   
   // ❌ Bad (requires parsing)
   {message: "Status: failed (3 failures)"}
   ```

2. **Explicit over implicit**
   ```typescript
   // ✅ Good
   {has_next: true, total_pages: 5}
   
   // ❌ Bad (must calculate)
   {page: 1, total_items: 87, page_size: 20}
   ```

3. **Actionable over descriptive**
   ```typescript
   // ✅ Good
   {action_required: true, commands: ["git rebase ..."]}
   
   // ❌ Bad
   {message: "You need to rebase"}
   ```

**Trade-offs**:
- ✅ LLM can parse easily
- ✅ Consistent structure
- ✅ Type-safe
- ⚠️ More verbose (but that's fine for JSON)

---

## Summary of Key Principles

1. **Tools provide data, LLMs provide intelligence**
2. **Default to inclusive, let LLM filter**
3. **Paginate always, with sensible defaults**
4. **Fast by default, wait when requested**
5. **Fail fast on user errors, retry on API errors**
6. **Generate actionable instructions**
7. **Stay stateless for simplicity**
8. **Optimize for AI, keep human-readable**

These decisions create a system that:
- Maximizes LLM strengths
- Minimizes token waste
- Provides clear, actionable outputs
- Remains simple and maintainable

