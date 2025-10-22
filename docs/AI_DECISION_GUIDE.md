# AI Agent Decision Guide

## When to Use `--onto` for Rebasing

The MCP tools provide recommendations, but the AI agent should make the final decision based on context.

### Scenario Detection

```typescript
interface RebaseScenario {
  base_pr_merged: boolean;
  merge_type: "squash" | "merge" | "rebase" | "unknown";
  dependent_has_base_commits: boolean;
  conflicts_expected: "low" | "medium" | "high";
}
```

## Decision Tree

### 1. Base PR Was Squash-Merged ✅ Use `--onto`

**Indicators**:
- `squash_merge: true` in tool response
- Base PR branch was deleted after merge
- Main has one new commit, but dependent PR has many commits from base

**Why `--onto`**: 
Dependent PR contains individual commits that are now squashed into one. Regular rebase tries to replay each commit (conflicts!). `--onto` skips them entirely.

**Command**:
```bash
git rebase --onto origin/main <last-base-commit> dependent-branch
```

**AI Prompt to User**:
```
I see that PR #100 was squash-merged into main. Your PR #101 contains 
those 10 individual commits. I'll use `git rebase --onto` to skip them 
and only rebase your 3 new commits. This avoids 10+ conflict resolutions.

Proceeding with: git rebase --onto origin/main abc123e pr-101
```

---

### 2. Base PR Was Merge-Committed → Use Regular Rebase

**Indicators**:
- `squash_merge: false`
- Base PR branch still exists or was normally merged
- Commit history is preserved in main

**Why regular rebase**:
Commits are still in main with same SHAs. Git can track them and rebase works normally.

**Command**:
```bash
git rebase origin/main
# or
git rebase <base-pr-branch>
```

**AI Prompt to User**:
```
PR #100 was merge-committed (not squashed), so its commits are preserved 
in main's history. A regular rebase will work cleanly.

Proceeding with: git rebase origin/main
```

---

### 3. Unsure or Complex → Offer Both Options

**Indicators**:
- `ai_should_decide: true` in tool response
- Both regular and `--onto` commands provided
- Multiple considerations listed

**AI Should**:
1. Analyze the considerations
2. Present both options to user
3. Recommend based on user's preference for history preservation

**AI Prompt to User**:
```
I see two viable approaches:

Option 1: Regular rebase (git rebase origin/main)
  ✓ Preserves all commit history
  ✓ Shows progression of changes
  ⚠ May have more conflicts to resolve

Option 2: --onto rebase (git rebase --onto origin/main abc123e pr-101)
  ✓ Skips intermediate history
  ✓ Fewer conflicts (only your changes)
  ⚠ Loses detail of how base PR evolved

Based on the squash-merge, I recommend Option 2 for a cleaner rebase. 
Shall I proceed?
```

---

## When `--onto` is Beneficial Even Without Squash-Merge

**Use cases**:

### 1. Long-lived Feature Branch
```
main: A---B---C---D---E (many changes)
      \
       F---G (your work from weeks ago)
```

Instead of replaying F,G through all of B,C,D,E:
```bash
git rebase --onto main <old-base> your-branch
```

### 2. Cherry-picking Commits
You only want specific commits, not entire history:
```bash
git rebase --onto main <before-first-wanted-commit> your-branch
```

### 3. Removing Commits from Middle
You want to remove commits but keep later ones:
```bash
git rebase --onto <keep-up-to-here> <skip-after-this> branch
```

---

## AI Decision Algorithm

```typescript
function decideRebaseStrategy(context: RebaseContext): RebaseDecision {
  // Clear squash-merge case
  if (context.squash_merge && context.dependent_has_base_commits) {
    return {
      strategy: "onto",
      confidence: "high",
      explanation: "Base PR was squash-merged, --onto avoids conflicts",
      command: buildOntoCommand(context)
    };
  }
  
  // Regular merge case
  if (!context.squash_merge && context.conflicts_expected === "low") {
    return {
      strategy: "regular",
      confidence: "high",
      explanation: "Normal merge, regular rebase is appropriate",
      command: "git rebase origin/main"
    };
  }
  
  // High conflict scenario
  if (context.conflicts_expected === "high") {
    return {
      strategy: "onto",
      confidence: "medium",
      explanation: "High conflicts expected, --onto may help by skipping history",
      command: buildOntoCommand(context),
      alternatives: ["interactive rebase", "manual cherry-pick"]
    };
  }
  
  // Ambiguous - ask user
  return {
    strategy: "ask_user",
    confidence: "low",
    explanation: "Multiple valid approaches",
    options: [
      { strategy: "regular", pros: [...], cons: [...] },
      { strategy: "onto", pros: [...], cons: [...] }
    ]
  };
}
```

---

## Common Patterns

### Pattern 1: Automatic Decision
```
Tool returns: { recommended: "onto", ai_should_decide: false }
AI: Proceeds with --onto without asking
User: Sees results, can rollback if needed
```

### Pattern 2: Guided Decision
```
Tool returns: { recommended: "onto", ai_should_decide: true, considerations: [...] }
AI: Presents options with analysis
User: Chooses or lets AI decide
AI: Executes chosen strategy
```

### Pattern 3: Adaptive Strategy
```
AI: Tries regular rebase
Result: Many conflicts
AI: "I see this is causing conflicts. Let me try --onto instead..."
AI: Rolls back, uses --onto
Result: Clean rebase
```

---

## Error Recovery

### If `--onto` Goes Wrong

```bash
# Always keep ORIG_HEAD
git reset --hard ORIG_HEAD

# Or use reflog
git reflog
git reset --hard HEAD@{5}
```

AI should mention this in prompts:
```
Note: If anything goes wrong, run: git reset --hard ORIG_HEAD
This will restore your branch to before the rebase.
```

---

## Examples of AI Decision Making

### Example 1: Clear Squash-Merge
```typescript
// Tool response
{
  squash_merge: true,
  rebase_strategy: {
    recommended: "onto",
    ai_should_decide: false
  }
}

// AI decision
"Using --onto because base PR was squash-merged. This is the standard approach."
→ Executes without asking
```

### Example 2: Ambiguous Case
```typescript
// Tool response
{
  squash_merge: false,
  conflicts_expected: "medium",
  rebase_strategy: {
    recommended: "regular",
    ai_should_decide: true,
    considerations: [
      "Base PR was merge-committed",
      "Some file overlap detected",
      "Could use --onto to skip intermediate commits"
    ]
  }
}

// AI decision
"The base PR was merge-committed, so regular rebase should work. However, 
I notice some file conflicts. Would you like me to:
1. Try regular rebase (standard approach)
2. Use --onto to skip intermediate history (fewer conflicts)

I recommend trying #1 first, then #2 if we hit issues."
→ Asks user or proceeds with #1
```

### Example 3: Conflict Recovery
```typescript
// AI tries regular rebase
result: { success: false, conflicts: 15 }

// AI adapts
"The regular rebase resulted in 15 conflicts. Let me try a different approach 
using --onto to skip the upstream commits..."

// AI executes --onto
result: { success: true, conflicts: 2 }

"Much better! The --onto rebase only has 2 conflicts in your actual changes. 
Let me help resolve those."
```

---

## Summary for AI Agents

**Default Rules**:
1. Squash-merge detected? → Use `--onto`
2. Regular merge with low conflicts? → Use regular rebase
3. High conflicts or unsure? → Consider `--onto` or ask user
4. Tool says `ai_should_decide: false`? → Follow the recommendation
5. Tool says `ai_should_decide: true`? → Analyze and present options

**Communication**:
- Always explain WHY you're using `--onto`
- Mention rollback procedure
- Show both commands when appropriate
- Adapt if first approach fails

