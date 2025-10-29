# Design Philosophy: Dumb Tool, Smart Agent

## Core Principle

**This tool is philosophically opposed to interpretation.**

We are a **data access layer** and **command generator**, not an AI assistant. The AI agent consuming our tools is already intelligent - we exist to make GitHub data accessible and actionable, not to compete with the agent's intelligence.

## Responsibilities

### ✅ Tool Responsibilities (Mechanical Work)

**Data Access**:

- Fetch from GitHub REST API
- Handle pagination
- Manage rate limiting
- Normalize responses

**Data Transformation**:

- Parse PR identifiers
- Format timestamps
- Combine related data (review comments + issue comments)
- Sort/filter by objective criteria

**Command Generation**:

- Generate GitHub CLI commands
- Provide action templates
- Include safety warnings

**Objective Facts Only**:

- Is this user a bot? (from GitHub API `type` field)
- What file/line? (from GitHub API)
- When created? (from GitHub API)
- How many reactions? (from GitHub API)

### ❌ Tool NEVER Does (Intelligent Work)

**Interpretation**:

- What does this comment mean?
- Is this important?
- Is this blocking?
- Should we fix this?

**Categorization**:

- Severity levels
- Priority scoring
- Keyword-based classification
- Sentiment analysis

**Decision Making**:

- When to resolve
- What to respond
- Which action to take
- Whether to escalate

**Content Generation**:

- Response text
- Fix suggestions
- Explanations

## Why This Boundary Matters

### 1. **Single Responsibility**

Each component does one thing well:

- Tool: GitHub data access
- Agent: Intelligence and decision-making

### 2. **Avoids Duplication**

The agent is ALREADY good at:

- Understanding natural language
- Categorizing urgency
- Making decisions
- Writing responses

We don't need to poorly replicate these capabilities.

### 3. **Flexibility**

Different agents may have different priorities:

- One agent might prioritize security comments
- Another might prioritize maintainer comments
- A third might focus on quick wins

By providing raw data, we let each agent decide.

### 4. **Maintainability**

- Interpretation logic is complex and subjective
- Keyword lists go stale
- Different projects have different priorities
- Keeping this in the agent (not the tool) keeps our code simple

## Real-World Example

**CodeRabbit Review Comment**:

```
_⚠️ Potential issue_ | _🟠 Major_

**Avoid double /user requests...**
```

### ❌ Bad Approach (Tool interprets)

```typescript
// Tool tries to be smart
{
  body: "⚠️ Potential issue...",
  severity: "high",          // Tool parsed emoji
  category: "performance",   // Tool guessed
  is_blocking: false,        // Tool decided
  suggested_response: "..."  // Tool wrote content
}
```

**Problems**:

- What if agent disagrees with "high" severity?
- What if this project doesn't care about performance?
- What if the suggested response is wrong?
- Now we have TWO AIs making conflicting decisions

### ✅ Good Approach (Tool provides, Agent decides)

```typescript
// Tool provides raw data + commands
{
  body: "_⚠️ Potential issue_ | _🟠 Major_\n\n**Avoid double /user requests...**",
  action_commands: {
    reply_command: "gh pr comment 2 --body 'YOUR_RESPONSE_HERE'",
    resolve_command: "gh api -X POST .../replies -f body='✅ Fixed'",
    resolve_condition: "Run ONLY after verifying fix for: 'Avoid double /user requests...'"
  }
}
```

**Agent's workflow**:

1. Reads body
2. Sees "_🟠 Major_" marker
3. Parses "Avoid double /user requests"
4. Decides: "This is valid, I'll fix it"
5. Makes the fix
6. Writes response: "Good catch! Fixed in commit abc123..."
7. Executes: `gh pr comment 2 --body "Good catch! Fixed in commit abc123..."`
8. Verifies fix is in PR
9. Executes resolve command

**Benefits**:

- Agent makes all intelligent decisions
- Tool just provides data and commands
- Agent can parse CodeRabbit format (agent is good at this!)
- No duplication of intelligence

## Guidelines for Implementation

### When adding new tool features, ask

**"Is this a fact or an opinion?"**

- Fact → Tool can provide it
- Opinion → Agent decides

**"Can GitHub API tell us this objectively?"**

- Yes → Tool returns it
- No → Agent interprets it

**"Does this require understanding natural language?"**

- No → Tool can do it (e.g., sort by file name)
- Yes → Agent does it (e.g., "is this urgent?")

**"Would different agents want different answers?"**

- Yes → Agent decides
- No → Tool can standardize

## Examples

| Feature | Tool or Agent? | Why |
|---------|---------------|-----|
| Fetch comment body | ✅ Tool | Objective API call |
| Sort by creation date | ✅ Tool | Objective comparison |
| Filter bots | ✅ Tool | GitHub API provides `type: "Bot"` |
| Parse PR identifier | ✅ Tool | Deterministic regex |
| Generate reply command | ✅ Tool | Mechanical template |
| **Decide if comment is important** | ❌ Agent | Subjective, context-dependent |
| **Categorize severity** | ❌ Agent | Opinion, varies by project |
| **Write response text** | ❌ Agent | Creative, context-dependent |
| **Decide when to resolve** | ❌ Agent | Requires verification |
| **Parse CodeRabbit severity** | ❌ Agent | Agent already good at NLP |

## Summary

**We're plumbing, not intelligence.**

Our value:

- ✅ Handle GitHub API complexity
- ✅ Provide commands agent can execute
- ✅ Make review workflow scriptable

Not our value:

- ❌ Duplicate agent's NLP abilities
- ❌ Make decisions agent should make
- ❌ Add interpretation layer

**The agent is smart. We help it act on GitHub.**
