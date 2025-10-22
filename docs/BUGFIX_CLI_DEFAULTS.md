# Bug Fix: CLI Defaults Not Respecting Schema Defaults

## Date: 2025-10-22

## Problem Discovery

User dogfooded the `find-unresolved-comments` tool on PR #2 and noticed it only found 2 comments, but CodeRabbit had posted 11 inline review comments that were missing.

### Root Cause

**CLI hardcoded defaults that diverged from Zod schema defaults:**

| Tool | Parameter | Schema Default | CLI Default | Result |
|------|-----------|----------------|-------------|--------|
| `find-unresolved-comments` | `include_bots` | `true` | `false` | ❌ Filtered out CodeRabbit comments |
| `get-failing-tests` | `bail_on_first` | `true` | `false` | ❌ Wrong behavior |
| `manage-stacked-prs` | `auto_fix` | `true` | `false` | ❌ Wrong behavior |
| `manage-stacked-prs` | `page_size` | `5` | `10` | ❌ Wrong pagination |

### Why This Happened

The CLI used Commander's `.option()` third parameter to set defaults:

```typescript
.option('--include-bots', 'Include bot comments', false)  // ❌ Hardcoded default
```

This created **two sources of truth** for defaults:
1. Zod schema defaults (in `schema.ts` files)
2. Commander option defaults (in `cli.ts`)

When they diverged, the CLI won, causing incorrect behavior.

## Solution

**Remove all CLI default values and let Zod schemas be the single source of truth:**

```typescript
// Before (❌ hardcoded):
.option('--include-bots', 'Include bot comments', false)

// After (✅ uses schema default):
.option('--include-bots', 'Include bot comments')
```

**Use Zod schema parsing to apply defaults:**

```typescript
const input = FindUnresolvedCommentsSchema.parse({
  pr: options.pr,
  ...(options.includeBots !== undefined && { include_bots: options.includeBots }),
  // Omitted options get schema defaults
});
```

## Changes Made

### 1. CLI Code (`src/cli.ts`)
- Removed all default values from `.option()` declarations
- Made all option types optional (`option?: type`)
- Added schema imports for validation
- Used `Schema.parse()` to apply defaults before calling handlers
- Used spread syntax to only pass defined options

### 2. Tests (`tests/cli/schema-defaults.cli.test.ts`)
- Added 8 tests to verify schema default behavior
- Tests that unspecified options use schema defaults
- Tests that explicit options override defaults
- Static analysis to ensure schemas are imported and used
- Documents that schemas are source of truth

## Verification

**Before fix:**
```bash
$ find-unresolved-comments --pr "jmalicki/resolve-pr-mcp#2"
Total unresolved: 2  # ❌ Only human comments, missing 11 bot comments
```

**After fix:**
```bash
$ find-unresolved-comments --pr "jmalicki/resolve-pr-mcp#2"
Total unresolved: 16  # ✅ Includes all CodeRabbit review comments
```

## Benefits

1. **Single Source of Truth**: Schema files define all defaults
2. **No Drift**: Changing schema defaults automatically changes CLI behavior
3. **Simpler Code**: No duplicate default logic in CLI
4. **Type Safe**: Zod validates and coerces types
5. **Maintainable**: Future developers only update one place

## Lessons Learned

### What Went Wrong

1. **Phase 3 Implementation Plan** didn't explicitly call out:
   - "CLI should not hardcode defaults"
   - "Use schema parsing for default application"
   - "Test that CLI respects schema defaults"

2. **Code Review** didn't catch the divergence because:
   - Defaults were set in two different files
   - No tests verified default behavior
   - No explicit guidance in implementation plan

### Prevention for Future

**Added to Implementation Plan checklist:**

```markdown
CLI Integration:
- [ ] CLI options have NO hardcoded defaults
- [ ] Use Schema.parse() to apply Zod defaults
- [ ] Test that unspecified options use schema defaults
- [ ] Test that explicit options override schema defaults
```

**Testing Strategy:**
- CLI tests must verify default behavior
- Tests should check both "option not provided" and "option explicitly provided"
- Static analysis tests to ensure schemas are used

## Related

- **Issue**: CodeRabbit comments not appearing in `find-unresolved-comments` output
- **PR**: #3 (Phase 3 - Core Tools)
- **Commits**: 
  - `b36b707` - fix(cli): remove hardcoded defaults, use Zod schema defaults only
  - `e8d9b08` - fix(cli): wire up actual tool handlers
  - `04c7047` - fix(tests): include CLI tests and fix coverage thresholds

## Documentation Updates Needed

- [x] Update CLI help text to clarify defaults come from schemas
- [x] Add tests for schema default behavior
- [x] Document the precedence: explicit arg > schema default
- [ ] Update IMPLEMENTATION_PLAN.md with explicit CLI default guidance
- [ ] Update TESTING_STRATEGY.md with CLI default testing requirements

