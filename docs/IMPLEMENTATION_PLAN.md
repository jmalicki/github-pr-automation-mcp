# Implementation Plan

## Phase Overview

The implementation is divided into 7 phases, each building on the previous:

1. **CI/CD Setup** - Establish automated testing and quality checks for all future PRs
2. **Foundation** - Core infrastructure and GitHub integration
3. **Core Tools** - Implement the 3 primary tools requested
3.5. **Fix Pagination** - Convert to MCP cursor-based pagination (protocol compliance)
4. **Enhanced Tools** - Add supplementary tools for comprehensive PR management
5. **Optimization** - Performance, caching, and error handling improvements
6. **Polish** - Documentation, examples, and deployment tooling

## PR Strategy: Stacked PRs

**Each phase = One PR, stacked on the previous phase**

```
main
 ├─ PR #1: Phase 1 - CI/CD Setup
     ├─ PR #2: Phase 2 - Foundation (stacked on Phase 1)
         ├─ PR #3: Phase 3 - Core Tools (stacked on Phase 2)
             ├─ PR #4: Phase 3.5 - Fix Pagination (stacked on Phase 3) 🆕
                 ├─ PR #5: Phase 4 - Enhanced Tools (stacked on Phase 3.5)
                     ├─ PR #6: Phase 5 - Optimization (stacked on Phase 4)
                         ├─ PR #7: Phase 6 - Polish (stacked on Phase 5)
```

### Branch Strategy

**Phase 1**:
- Branch: `phase-1-ci-setup` (off `main`)
- PR: `phase-1-ci-setup` → `main`

**Phase 2**:
- Branch: `phase-2-foundation` (off `phase-1-ci-setup`)
- PR: `phase-2-foundation` → `phase-1-ci-setup`

**Phase 3**:
- Branch: `phase-3-core-tools` (off `phase-2-foundation`)
- PR: `phase-3-core-tools` → `phase-2-foundation`

**Phase 3.5** 🆕:
- Branch: `phase-3.5-fix-pagination` (off `phase-3-core-tools`)
- PR: `phase-3.5-fix-pagination` → `phase-3-core-tools`

**Phase 4**:
- Branch: `phase-4-enhanced-tools` (off `phase-3.5-fix-pagination`)
- PR: `phase-4-enhanced-tools` → `phase-3.5-fix-pagination`

**Phase 5**:
- Branch: `phase-5-optimization` (off `phase-4-enhanced-tools`)
- PR: `phase-5-optimization` → `phase-4-enhanced-tools`

**Phase 6**:
- Branch: `phase-6-polish` (off `phase-5-optimization`)
- PR: `phase-6-polish` → `phase-5-optimization`

### Merge Strategy

**As each phase completes**:
1. Merge Phase 1 → `main`
2. Update Phase 2's base to `main` (rebase)
3. Merge Phase 2 → `main`
4. Update Phase 3's base to `main` (rebase)
5. Merge Phase 3 → `main`
6. Update Phase 3.5's base to `main` (rebase)
7. Merge Phase 3.5 → `main`
8. Update Phase 4's base to `main` (rebase)
9. Continue pattern...

**Benefits**:
- ✅ Each PR is focused and reviewable
- ✅ Can work on later phases before earlier ones merge
- ✅ Easy to rollback or adjust individual phases
- ✅ Progressive delivery - can ship Phase 1 while working on Phase 2

### Using manage_stacked_prs (Dogfooding!)

Once Phase 3 is complete, we can use our own `manage_stacked_prs` tool to manage the stack:

```bash
# After Phase 2 merges, update Phase 3
resolve-pr-mcp manage-stacked-prs \
  --base-pr "jmalicki/resolve-pr-mcp#2" \
  --dependent-pr "jmalicki/resolve-pr-mcp#3"

# Iterative testing of our own tools!
```

---

## Phase 1: CI/CD Setup (Week 1, Day 1-2)

**Branch**: `phase-1-ci-setup` (off `main`)  
**PR**: → `main`

### Goals
- Set up automated testing for all future PRs
- Configure linting and type checking
- Establish quality gates
- Enable all stacked PRs to benefit from CI

### Tasks

#### 1.1 GitHub Actions Workflows

- [ ] Create `.github/workflows/test.yml` - Run tests on every PR
- [ ] Create `.github/workflows/lint.yml` - Linting and type checking
- [ ] Create `.github/workflows/build.yml` - Verify build succeeds
- [ ] Configure branch protection rules for `main`
- [ ] Set up required status checks

**Test Workflow**:
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm test -- --coverage
      - name: Check coverage thresholds
        run: npm run test:coverage-check
```

**Lint Workflow**:
```yaml
# .github/workflows/lint.yml
name: Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
```

#### 1.2 Linting Configuration

- [ ] Install ESLint and TypeScript ESLint
- [ ] Create `.eslintrc.json` with rules
- [ ] Create `.eslintignore`
- [ ] Add lint script to package.json
- [ ] Fix any existing lint issues

#### 1.3 Test Configuration (Vitest)

- [ ] Install Vitest and dependencies
- [ ] Create `vitest.config.ts`
- [ ] Set up test directory structure
- [ ] Create initial test utilities
- [ ] Add coverage thresholds (85%)

#### 1.4 Pre-commit Hooks (Optional but Recommended)

- [ ] Install Husky
- [ ] Configure pre-commit hook (lint + type-check)
- [ ] Configure commit-msg hook (Conventional Commits validation)

### Phase 1 Deliverables
- [ ] GitHub Actions workflows running on all PRs
- [ ] Linting enforced
- [ ] Type checking enforced
- [ ] Test infrastructure ready
- [ ] Branch protection enabled on `main`

### Phase 1 Success Criteria
- [ ] CI passes on this PR
- [ ] Can push commits and see CI run
- [ ] Lint errors block merge
- [ ] Test failures block merge

**Why First?**: All subsequent stacked PRs (Phases 2-6) will automatically get CI validation, ensuring quality from the start.

---

## Phase 2: Foundation (Week 1, Day 3-5)

**Branch**: `phase-2-foundation` (off `phase-1-ci-setup`)  
**PR**: → `phase-1-ci-setup` (stacked on Phase 1)

### Goals
- Set up TypeScript project structure
- Implement MCP server skeleton
- Create GitHub API client wrapper
- Build core utilities and types

### Tasks

#### 1.1 Project Setup
- [x] Initialize npm project with TypeScript
- [x] Configure tsconfig.json for Node16 modules
- [x] Set up build scripts
- [x] Create .gitignore

#### 1.2 MCP Server Bootstrap

**Reference**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for transport details (stdio, not HTTP)

**Tasks**:
- [ ] Create `src/index.ts` - MCP server entry point
- [ ] Set up stdio transport (StdioServerTransport)
- [ ] Register tool handler routing
- [ ] Add graceful shutdown handling
- [ ] Validate it works with `npm run dev`

**Dependencies**:
- `@modelcontextprotocol/sdk` - MCP protocol over stdio
- `zod` - Schema validation

**Key Files**:
- `src/index.ts` - Server entry point (stdio)
- `src/server.ts` - Server configuration
- `src/types/` - Shared type definitions

#### 1.2.1 CLI Mode (Bonus)

**Reference**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for CLI vs MCP mode

**Tasks**:
- [ ] Create `src/cli.ts` with commander setup
- [ ] Implement lazy GitHub client initialization (allow --help without token)
- [ ] Add placeholder commands for all 8 tools (Phase 2 only adds placeholders)
- [ ] Implement JSON and human-readable output formatting
- [ ] Add to package.json bin field
- [ ] Test `--help` works without GITHUB_TOKEN
- [ ] Test with `npm run cli -- <command> --help`

**Important**: Phase 2 creates CLI infrastructure with **placeholders only**. 
Tools will be wired up in Phase 3 when handlers are implemented.

**Dependencies**: 
- `commander` - CLI argument parsing

**Key Files**:
- `src/cli.ts` - CLI entry point (lazy init, placeholders)
- `dist/cli.js` - Built CLI (set as bin in package.json)

#### 1.3 GitHub API Integration

**Reference**: See [GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md) for API patterns

**Tasks**:
- [ ] Create `src/github/client.ts` - Octokit wrapper
- [ ] Implement token validation on startup
- [ ] Add rate limit tracking and warnings
- [ ] Create error handling utilities
- [ ] Add request/response logging (debug mode)
- [ ] Test with real GitHub API

**Key Files**:
- `src/github/client.ts` - Main client
- `src/github/types.ts` - GitHub-specific types
- `src/github/errors.ts` - Error handling

#### 1.4 Core Utilities

**Reference**: See [API_DESIGN.md](./API_DESIGN.md) for PR identifier format

**Tasks**:
- [ ] Create `src/utils/parser.ts` - PR identifier parsing
- [ ] Create `src/utils/pagination.ts` - Pagination helpers
- [ ] Create `src/utils/formatting.ts` - Output formatting
- [ ] Create `src/utils/validation.ts` - Zod schemas
- [ ] Write unit tests for all utilities (>90% coverage)

**Key Files**:
- `src/utils/parser.ts`
- `src/utils/pagination.ts`
- `src/utils/formatting.ts`
- `src/utils/validation.ts`

#### 2.5 Testing Infrastructure

**Reference**: See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for full strategy

**Tasks**:
- [ ] Create test fixtures for GitHub API responses
- [ ] Write tests for utilities (>90% coverage)
- [ ] Set up mock GitHub client

**Files**:
- `tests/setup.ts` - Test configuration
- `tests/fixtures/` - Mock GitHub responses
- `tests/utils/` - Test helpers
- `tests/mocks/` - Mock implementations

### Phase 2 Deliverables
- [ ] Working MCP server that can be started
- [ ] GitHub API client that authenticates
- [ ] Core utility functions with tests (>90% coverage)
- [ ] Type definitions for all major entities
- [ ] CLI mode working for testing
- [ ] All CI checks passing

### Phase 2 Success Criteria
- [ ] Server starts and responds to MCP protocol requests
- [ ] Can fetch a PR from GitHub successfully
- [ ] All utility tests pass
- [ ] CI pipeline validates this PR
- [ ] Documentation updated

---

## Phase 3: Core Tools Implementation (Week 2-3)

**Branch**: `phase-3-core-tools` (off `phase-2-foundation`)  
**PR**: → `phase-2-foundation` (stacked on Phase 2)

### Goals
- Implement `get_failing_tests`
- Implement `find_unresolved_comments`
- Implement `manage_stacked_prs`

### 3.1 Tool: get_failing_tests

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#1-get_failing_tests) for full spec

**Schema & Handler**:
- [x] Create `src/tools/get-failing-tests/schema.ts` with Zod input/output schemas
- [x] Add 💾 emoji to preference-worthy parameters (bail_on_first, page_size, wait)
- [x] Implement `src/tools/get-failing-tests/handler.ts` main function
- [x] Accept GitHubClient and input, return output matching schema
- [x] Fetch PR to get head SHA
- [x] Get check runs for commit
- [x] Handle empty check runs (no CI configured)
- [x] Filter completed vs pending runs
- [x] Implement wait mode with polling if requested
- [x] Implement bail-on-first logic
- [x] Extract failures from failed check runs (basic - detailed parsing deferred)
- [x] Implement pagination using paginateResults utility
- [x] Generate instructions summary
- [x] Return proper status (passed/failed/running/unknown)

**Supporting Code** (implemented inline in handler):
- [x] CI status fetching logic (inline in handler.ts, not separate file)
- [x] Basic failure extraction (detailed log parsing deferred to Phase 4)
- [x] Instructions generation (inline in handler.ts)
- [ ] User preference loading (deferred to Phase 5)

**CLI Integration**:
- [x] Wire up CLI command in `src/cli.ts` to call handler
- [x] **CRITICAL**: CLI options must have NO hardcoded defaults (use schema defaults)
- [x] Use `Schema.parse()` to apply Zod defaults before calling handler
- [x] Pass only defined options using spread syntax
- [x] Format JSON output (--json flag)
- [x] Format human-readable output (default)
- [x] Handle errors and exit codes properly
- [x] Verify lazy init allows --help without token

**Unit Tests** (tests/tools/get-failing-tests.test.ts):
- [x] Test with no CI checks configured
- [x] Test with all passing checks
- [x] Test with failed checks - verify failure extraction
- [x] Test wait mode with pending checks
- [x] Test bail-on-first behavior
- [x] Test pagination (multiple pages)
- [x] Test PR identifier format parsing
- [x] Test mixed status (passed/failed/pending)

**Integration Tests** (tests/integration/tools/):
- [x] Test against real GitHub PR with CI (placeholder created)
- [x] Verify actual API responses handled correctly

**CLI Tests** (tests/cli/get-failing-tests.cli.test.ts):
- [x] Test --help shows usage without requiring token
- [x] Test --pr argument is required
- [x] Test PR identifier formats accepted
- [x] Test --json outputs valid JSON
- [x] Test default outputs human-readable format
- [x] Test pagination arguments (--page, --page-size)
- [x] Test invalid PR format shows error
- [x] Test exit codes (0 for success, non-zero for errors)
- [x] **Test unspecified options use Zod schema defaults** (schema-defaults.cli.test.ts)
- [x] **Test explicit options override schema defaults** (schema-defaults.cli.test.ts)

**Acceptance**:
- [x] npm test passes all unit tests (7 tests)
- [x] npm run cli -- get-failing-tests --help works without token
- [x] npm run cli -- get-failing-tests --pr "owner/repo#123" works with token
- [x] Handler returns data matching output schema
- [x] Real PR test successful (dogfooded on PR #3!)

**Key Files** (as implemented):
- `src/tools/get-failing-tests/schema.ts` ✅
- `src/tools/get-failing-tests/handler.ts` ✅ (includes inline CI fetching and failure extraction)
- Note: Log parsing and detailed extraction deferred to Phase 4 enhancements

### 3.2 Tool: find_unresolved_comments

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#2-find_unresolved_comments) for full spec

**Important**: Tool returns raw data + action commands. AI agent interprets content and decides actions.

**Design Boundary**: Tool does NOT categorize, interpret, or suggest responses. Agent does that.

**Schema & Handler**:
- [ ] Create `src/tools/find-unresolved-comments/schema.ts` with Zod schemas
- [ ] Add 💾 emoji to preference parameters (include_bots, page_size, sort)
- [ ] Update Comment interface to include `action_commands`
- [ ] Implement `src/tools/find-unresolved-comments/handler.ts` main function
- [ ] Fetch review comments (inline code comments)
- [ ] Fetch issue comments (general PR comments)
- [ ] Normalize both comment types to unified Comment type
- [ ] Detect bot comments (user.type === 'Bot') - objective fact only
- [ ] Filter by include_bots parameter
- [ ] Filter by exclude_authors parameter
- [ ] Implement sorting: chronological, by_file, by_author
- [ ] **Generate GitHub CLI reply command for each comment**
- [ ] **Generate GitHub CLI resolve command for each comment**
- [ ] **Add resolve_condition warning (only run after fix verified)**
- [ ] Build summary statistics (by_author, by_type, bot/human counts)
- [ ] Implement pagination using paginateResults utility
- [ ] Return comments with file paths, line numbers, bodies, commands
- [ ] **DO NOT add categorization/severity/keyword detection (agent's job!)**

**Supporting Code**:
- [ ] Create `src/github/comment-manager.ts` for comment API interactions
- [ ] Create `command-generator.ts` for GitHub CLI command templates
  - [ ] Generate reply commands (gh pr comment, gh pr review comment)
  - [ ] Generate resolve commands (gh api POST for review comment replies)
  - [ ] Include resolve_condition warnings (first line of comment)
  - [ ] **NO categorization/severity logic** (agent does this)
- [ ] Add user preference loading in handler

**CLI Integration**:
- [x] Wire up CLI command in `src/cli.ts` to call handler
- [x] **CRITICAL**: CLI options must have NO hardcoded defaults (use schema defaults)
- [x] Use `Schema.parse()` to apply Zod defaults before calling handler
- [x] Parse --include-bots, --exclude-authors, --sort arguments
- [x] Format JSON output (--json flag)
- [x] Format human-readable output with emojis (default)
- [x] Handle errors and exit codes properly

**Unit Tests** (tests/tools/find-unresolved-comments.test.ts):
- [x] Test fetching and combining review + issue comments
- [x] Test bot filtering (include_bots true/false)
- [x] Test exclude_authors filtering
- [x] Test sorting by file (alphabetical, then line number)
- [x] Test sorting by author (alphabetical, then chronological)
- [x] Test sorting chronologically
- [x] Test pagination (multiple pages)
- [x] Test summary statistics generation
- [x] **Test action_commands generation** (reply_command, resolve_command, view_in_browser)
- [x] **Test resolve_condition includes comment excerpt**
- [x] **Test commands use correct GitHub CLI syntax**

**Integration Tests**:
- [x] Test against real GitHub PR with comments (placeholder created)
- [x] Test bot comment filtering with real bots

**CLI Tests** (tests/cli/find-unresolved-comments.cli.test.ts):
- [x] Test --help without token
- [x] Test --pr required
- [x] Test --json outputs valid JSON with all fields
- [x] Test default human-readable format
- [x] Test --sort options (chronological, by_file, by_author)
- [x] Test --include-bots flag
- [x] Test exit codes

**Acceptance**:
- [x] All unit tests pass (7 tests)
- [x] CLI --help works without token
- [x] CLI with valid PR returns comment data
- [x] Bot filtering works correctly (tested - found 16 bot comments on PR #2!)
- [x] Summary statistics accurate
- [x] **Each comment includes valid reply_command**
- [x] **Each comment includes resolve_command with warning**
- [x] **Resolve commands clearly state "only after verifying fix"**
- [x] **NO categorization/interpretation logic in tool** (agent does this)

**Key Files** (as implemented):
- `src/tools/find-unresolved-comments/schema.ts` ✅
- `src/tools/find-unresolved-comments/handler.ts` ✅ (includes inline comment fetching)
- `src/tools/find-unresolved-comments/command-generator.ts` ✅

### 3.3 Tool: manage_stacked_prs

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#3-manage_stacked_prs) and [AI_DECISION_GUIDE.md](./AI_DECISION_GUIDE.md) for rebase strategy

**Important**: Detect squash merges and recommend regular vs --onto rebase strategy

**Schema & Handler**:
- [x] Create `src/tools/manage-stacked-prs/schema.ts` with Zod schemas
- [x] Add 💾 emoji to preference parameters (auto_fix, use_onto, page_size)
- [x] Include optional use_onto and onto_base parameters
- [x] Implement `src/tools/manage-stacked-prs/handler.ts` main function
- [x] Parse both PR identifiers
- [x] Verify both PRs in same repository (throw error if not)
- [x] Fetch both PRs in parallel
- [x] Check if stacked (dependent.base === base.head branch)
- [x] Compare commits between PRs to detect changes
- [x] Detect if base PR was squash-merged (basic detection)
- [x] Build change summary (commits, files, potential conflicts)
- [x] Generate git commands for rebase workflow
- [ ] Include --onto command variant if applicable (deferred - regular rebase works)
- [ ] Generate rebase_strategy with recommendation and reasoning (deferred)
- [ ] Provide AI decision factors if both strategies viable (deferred)
- [x] Create ASCII visualization of stack (basic text visualization)
- [x] Implement pagination for commands
- [x] Calculate estimated time and risk level

**Supporting Code** (as implemented):
- [x] PR comparison logic (inline in handler.ts, not separate file)
- [x] Git command generation (inline in handler.ts)
- [ ] Squash merge detection (deferred to Phase 4 with rebase_after_squash_merge tool)
- [ ] User preference loading (deferred to Phase 5)

**CLI Integration**:
- [x] Wire up CLI command in `src/cli.ts` to call handler
- [x] **CRITICAL**: CLI options must have NO hardcoded defaults (use schema defaults)
- [x] Use `Schema.parse()` to apply Zod defaults before calling handler
- [x] Parse --base-pr and --dependent-pr (both required)
- [x] Parse --auto-fix and --use-onto flags
- [x] Format JSON output (--json flag)
- [x] Format human-readable output with emojis (default)
- [x] Show stack visualization in human output
- [x] List commands with step numbers
- [x] Handle errors and exit codes properly

**Unit Tests** (tests/tools/manage-stacked-prs.test.ts):
- [x] Test detecting stacked PRs (base branch matches)
- [x] Test detecting non-stacked PRs
- [x] Test error when PRs in different repos
- [x] Test no changes detected scenario
- [x] Test changes detected - verify command generation
- [ ] Test --onto strategy when use_onto=true (deferred - basic rebase works)
- [ ] Test regular rebase strategy when use_onto=false (deferred)
- [x] Test pagination of commands
- [x] Test change summary generation
- [ ] Test rebase_strategy recommendation (deferred)

**Integration Tests**:
- [x] Test with real stacked PRs (dogfooded on PR #2 and #3!)
- [x] Verify stacked detection works (detected our own stack)
- [ ] Test rebase strategy detection (deferred)

**CLI Tests** (tests/cli/manage-stacked-prs.cli.test.ts):
- [x] Test --help without token
- [x] Test both --base-pr and --dependent-pr required
- [x] Test --json outputs valid JSON
- [x] Test default human-readable output
- [x] Test exit codes
- [x] Test error when PRs in different repos

**Acceptance**:
- [x] All unit tests pass (9 tests)
- [x] CLI --help works
- [x] CLI with valid PRs returns stack analysis
- [x] Stacked detection accurate (dogfooded on our own PRs!)
- [x] Commands generated correctly (we used them to rebase!)
- [x] Rebase workflow successful (rebased PR #3 onto PR #2)

**Key Files** (as implemented):
- `src/tools/manage-stacked-prs/schema.ts` ✅
- `src/tools/manage-stacked-prs/handler.ts` ✅ (includes inline PR analysis and command generation)
- Note: Advanced rebase strategy detection (--onto) deferred to Phase 4

### Phase 3 Deliverables
- [x] All 3 core tools functional and tested
- [x] Test coverage: 60.73% lines, 62.5% functions, 80.64% branches (>60% target met)
- [x] Input validation working with Zod schemas
- [x] Pagination implemented and tested (page numbers - to be fixed in Phase 3.5)
- [x] Error handling robust (normalized GitHub errors)
- [ ] User preferences system (deferred to Phase 5)
- [ ] Advanced rebase strategy detection (deferred to Phase 4 - rebase_after_squash_merge tool)
- [x] CI validates all tools
- [x] **Successfully dogfooded on our own PRs!**

---

## Phase 3.5: Fix MCP Pagination (Week 2.5)

**Branch**: `phase-3.5-fix-pagination` (off `phase-3-core-tools`)  
**PR**: → `phase-3-core-tools` (stacked between Phase 3 and Phase 4)

### Goals
- Fix pagination to comply with MCP specification
- Convert from page numbers to opaque cursors
- Ensure protocol compliance

### Problem

**Current**: Page-based pagination (non-compliant)
```typescript
{ page: 1, page_size: 20, total_pages: 5, has_next: true }
```

**MCP Spec**: Cursor-based pagination
```typescript
{ nextCursor: "eyJwYWdlIjogM30=" }
```

Reference: https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination

### Tasks

#### 3.5.1 Update Pagination Model

- [ ] Update `src/types/index.ts`:
  - [ ] Remove `PaginationMeta` interface
  - [ ] Add `CursorPagination` interface: `{ nextCursor?: string }`
  - [ ] Update `PaginatedResult<T>` to use cursor model

- [ ] Update `src/utils/pagination.ts`:
  - [ ] Implement `encodeCursor(offset: number, pageSize: number): string`
  - [ ] Implement `decodeCursor(cursor: string): { offset: number, pageSize: number }`
  - [ ] Update `paginateResults` to accept cursor instead of page
  - [ ] Return `nextCursor` only if more results exist
  - [ ] Use base64 encoding for opaque cursors

#### 3.5.2 Update Tool Schemas

- [ ] `get_failing_tests/schema.ts`:
  - [ ] Replace `page` with optional `cursor?: string`
  - [ ] Remove `page_size` from input (server controlled)
  - [ ] Update output pagination to `{ nextCursor?: string }`

- [ ] `find_unresolved_comments/schema.ts`:
  - [ ] Replace `page` with optional `cursor?: string`
  - [ ] Remove `page_size` from input (server controlled)
  - [ ] Update output pagination to `{ nextCursor?: string }`

- [ ] `manage_stacked_prs/schema.ts`:
  - [ ] Replace `page` with optional `cursor?: string`
  - [ ] Remove `page_size` from input (server controlled)
  - [ ] Update output pagination to `{ nextCursor?: string }`

#### 3.5.3 Update Handlers

- [ ] Update all 3 tool handlers to:
  - [ ] Accept `cursor` parameter instead of `page`
  - [ ] Decode cursor to get offset
  - [ ] Use server-defined page sizes (10, 20, 5 respectively)
  - [ ] Return `nextCursor` if more results exist
  - [ ] Handle missing cursor as "start from beginning"

#### 3.5.4 Update CLI

- [ ] Remove `--page` and `--page-size` flags from all commands
- [ ] Add `--cursor` flag for continuation
- [ ] Update human-readable output to show cursor for next page
- [ ] Update JSON output to include nextCursor

#### 3.5.5 Update Tests

- [ ] Update all unit tests to use cursor model
- [ ] Test cursor encoding/decoding
- [ ] Test missing cursor (start from beginning)
- [ ] Test invalid cursor handling
- [ ] Update CLI tests to remove page flags
- [ ] Update integration tests

### Phase 3.5 Deliverables

- [ ] Cursor-based pagination implemented
- [ ] All tests updated and passing
- [ ] MCP protocol compliant
- [ ] CLI updated for cursor model
- [ ] Documentation updated

### Phase 3.5 Success Criteria

- [ ] No page numbers in schemas
- [ ] Cursors are opaque (base64 encoded)
- [ ] Server controls page size
- [ ] nextCursor only present when more results exist
- [ ] All tests passing
- [ ] CI validates changes

---

## Phase 4: Enhanced Tools (Week 4)

**Branch**: `phase-4-enhanced-tools` (off `phase-3-core-tools`)  
**PR**: → `phase-3-core-tools` (stacked on Phase 3)

### Goals
- Implement 5 supplementary tools
- Add value beyond core functionality
- Create composable tool ecosystem
- Implement rebase strategy detection

### 4.1 Tool: detect_merge_conflicts

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#4-detect_merge_conflicts)

**Complexity**: Medium | **Priority**: High | **Time**: 1 day

**Schema & Handler**:
- [ ] Create `src/tools/detect-merge-conflicts/schema.ts` with Zod schemas
- [ ] Implement `handler.ts` main function
- [ ] Fetch PR to check mergeable state
- [ ] Use GitHub's `mergeable_state` API field
- [ ] Detect "dirty" state (conflicts present)
- [ ] Implement dry-run merge detection if needed
- [ ] Parse conflict markers from diff if available
- [ ] Identify conflicting files from GitHub API
- [ ] Generate resolution suggestions per file
- [ ] Return conflict status, files, and suggestions

**CLI Integration**:
- [ ] Wire up CLI command in `src/cli.ts`
- [ ] Parse --pr and --target-branch arguments
- [ ] Format JSON output
- [ ] Format human-readable output
- [ ] Handle errors and exit codes

**Unit Tests**:
- [ ] Test PR with no conflicts (mergeable_state: clean)
- [ ] Test PR with conflicts (mergeable_state: dirty)
- [ ] Test PR with unknown state
- [ ] Test conflict file identification
- [ ] Test resolution suggestions generation

**CLI Tests**:
- [ ] Test --help without token
- [ ] Test --pr required
- [ ] Test JSON output format
- [ ] Test human-readable output
- [ ] Test exit codes

**Acceptance**:
- [ ] All tests pass
- [ ] CLI --help works
- [ ] CLI detects conflicts on real PR
- [ ] Suggestions are actionable

### 4.2 Tool: check_merge_readiness

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#5-check_merge_readiness)

**Complexity**: Medium | **Priority**: High | **Time**: 1 day

**Schema & Handler**:
- [ ] Create `src/tools/check-merge-readiness/schema.ts` with Zod schemas
- [ ] Implement `handler.ts` main function
- [ ] Check CI status (reuse logic from get_failing_tests)
- [ ] Verify all required checks passed
- [ ] Check review approvals (fetch reviews)
- [ ] Parse branch protection rules
- [ ] Verify minimum approval count met
- [ ] Check for merge conflicts (reuse detect_merge_conflicts logic)
- [ ] Verify branch is up to date with base
- [ ] Calculate ready_to_merge boolean
- [ ] Generate next_steps array if not ready
- [ ] Return checklist with pass/fail for each requirement

**CLI Integration**:
- [ ] Wire up CLI command in `src/cli.ts`
- [ ] Parse --pr argument
- [ ] Format JSON output with all checks
- [ ] Format human-readable output with ✅/❌ indicators
- [ ] Handle errors and exit codes

**Unit Tests**:
- [ ] Test PR ready to merge (all checks pass)
- [ ] Test PR with failing CI
- [ ] Test PR with insufficient approvals
- [ ] Test PR with merge conflicts
- [ ] Test PR behind base branch
- [ ] Test next_steps generation when not ready

**CLI Tests**:
- [ ] Test --help without token
- [ ] Test --pr required
- [ ] Test JSON output format
- [ ] Test human-readable checklist format
- [ ] Test exit codes

**Acceptance**:
- [ ] All tests pass
- [ ] CLI works on real PR
- [ ] Accurately identifies merge blockers
- [ ] Next steps are clear and actionable

### 4.3 Tool: analyze_pr_impact

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#6-analyze_pr_impact)

**Complexity**: High | **Priority**: Medium | **Time**: 2 days

**Schema & Handler**:
- [ ] Create `src/tools/analyze-pr-impact/schema.ts` with Zod schemas
- [ ] Add depth parameter (summary vs detailed)
- [ ] Implement `handler.ts` main function
- [ ] Fetch PR data including files changed
- [ ] Calculate lines added/deleted totals
- [ ] Categorize files by impact area using heuristics:
  - [ ] Database changes (migrations, schema files)
  - [ ] API changes (routes, controllers, endpoints)
  - [ ] Security changes (auth, crypto, permissions)
  - [ ] Frontend changes (UI components, styles)
  - [ ] Testing changes (test files)
  - [ ] Configuration changes (config files, env)
- [ ] Fetch file history for changed files (if detailed)
- [ ] Identify frequent contributors to changed files
- [ ] Generate suggested reviewers based on file history
- [ ] Find similar PRs (optional, if detailed)
- [ ] Calculate risk level based on impact
- [ ] Generate detailed analysis report

**CLI Integration**:
- [ ] Wire up CLI command in `src/cli.ts`
- [ ] Parse --pr and --depth arguments
- [ ] Format JSON output
- [ ] Format human-readable impact report
- [ ] Show impact areas with file lists
- [ ] Handle errors and exit codes

**Unit Tests**:
- [ ] Test summary depth analysis
- [ ] Test detailed depth analysis
- [ ] Test impact area categorization (database, API, security, etc.)
- [ ] Test lines added/deleted calculation
- [ ] Test suggested reviewers generation
- [ ] Test risk level calculation

**CLI Tests**:
- [ ] Test --help without token
- [ ] Test --pr required
- [ ] Test --depth summary (default)
- [ ] Test --depth detailed
- [ ] Test JSON output format
- [ ] Test human-readable impact report
- [ ] Test exit codes

**Acceptance**:
- [ ] All tests pass
- [ ] CLI shows impact analysis on real PR
- [ ] Impact areas correctly identified
- [ ] Suggested reviewers make sense
- [ ] Risk level is reasonable

### 4.4 Tool: get_review_suggestions

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#7-get_review_suggestions)

**Complexity**: High | **Priority**: Medium | **Time**: 2 days

**Schema & Handler**:
- [ ] Create `src/tools/get-review-suggestions/schema.ts` with Zod schemas
- [ ] Add focus_areas, include_diff, max_diff_lines parameters
- [ ] Implement `handler.ts` main function
- [ ] Fetch PR data (title, body, files, diff)
- [ ] Generate review checklist based on changes:
  - [ ] Logic correctness and edge cases
  - [ ] Security vulnerabilities
  - [ ] Performance impact
  - [ ] Error handling
  - [ ] API design principles
  - [ ] Test coverage
- [ ] Extract relevant diff excerpts (if include_diff=true)
- [ ] Limit diff to max_diff_lines
- [ ] Identify focus points from PR body and file changes:
  - [ ] Security keywords (auth, crypto, sql, password)
  - [ ] Performance keywords (query, loop, cache)
  - [ ] Breaking changes keywords
- [ ] Link related issues from PR body (#123 references)
- [ ] Link related PRs
- [ ] Generate suggested review comments
- [ ] Return checklist, focus points, diff excerpts

**CLI Integration**:
- [ ] Wire up CLI command in `src/cli.ts`
- [ ] Parse --pr, --focus-areas, --include-diff, --max-diff-lines
- [ ] Format JSON output
- [ ] Format human-readable review guide
- [ ] Show checklist with checkboxes
- [ ] Show focus points
- [ ] Show relevant diff sections
- [ ] Handle errors and exit codes

**Unit Tests**:
- [ ] Test checklist generation
- [ ] Test focus point identification (security, performance)
- [ ] Test diff excerpt extraction
- [ ] Test max_diff_lines limiting
- [ ] Test related issue/PR linking
- [ ] Test with include_diff=true and false

**CLI Tests**:
- [ ] Test --help without token
- [ ] Test --pr required
- [ ] Test --focus-areas with multiple values
- [ ] Test --include-diff flag
- [ ] Test --max-diff-lines limit
- [ ] Test JSON output format
- [ ] Test human-readable review guide
- [ ] Test exit codes

**Acceptance**:
- [ ] All tests pass
- [ ] CLI generates review guide on real PR
- [ ] Checklist is comprehensive
- [ ] Focus points are relevant
- [ ] Diff excerpts are useful
- [ ] Suggestions are actionable

### 4.5 Tool: rebase_after_squash_merge

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#8-rebase_after_squash_merge)

**Complexity**: Medium | **Priority**: Medium | **Time**: 1 day

**Schema & Handler**:
- [ ] Create `src/tools/rebase-after-squash-merge/schema.ts` with Zod schemas
- [ ] Add pr, upstream_pr (optional), target_branch (optional) parameters
- [ ] Implement `handler.ts` main function
- [ ] Fetch your PR data
- [ ] Fetch upstream PR data (if provided)
- [ ] Detect if upstream PR was squash-merged:
  - [ ] Check if upstream PR commits exist in target branch as individuals
  - [ ] Check if squash commit exists in target branch
  - [ ] Compare commit counts
- [ ] Identify last upstream commit before user's work started
- [ ] Generate `git rebase --onto` command with correct SHAs
- [ ] Generate regular rebase command as alternative
- [ ] Create before/after ASCII visualization
- [ ] Generate full command sequence with explanations
- [ ] Add warnings if detection uncertain
- [ ] Integrate recommendation logic with manage_stacked_prs

**CLI Integration**:
- [ ] Wire up CLI command in `src/cli.ts`
- [ ] Parse --pr, --upstream-pr, --target-branch arguments
- [ ] Format JSON output
- [ ] Format human-readable command guide
- [ ] Show before/after visualization
- [ ] Show command sequence with explanations
- [ ] Handle errors and exit codes

**Unit Tests**:
- [ ] Test squash merge detection (true positive)
- [ ] Test non-squash merge (true negative)
- [ ] Test last upstream commit identification
- [ ] Test --onto command generation
- [ ] Test regular rebase command generation
- [ ] Test visualization generation
- [ ] Test command sequence completeness
- [ ] Test warnings when uncertain

**CLI Tests**:
- [ ] Test --help without token
- [ ] Test --pr required
- [ ] Test with --upstream-pr provided
- [ ] Test with --target-branch provided
- [ ] Test JSON output format
- [ ] Test human-readable guide with visualization
- [ ] Test exit codes

**Acceptance**:
- [ ] All tests pass
- [ ] CLI detects squash merges correctly
- [ ] --onto command is correct
- [ ] Visualization is clear
- [ ] Command sequence is complete and safe
- [ ] Works on real stacked PRs from this repo

---

## Phase 5: Optimization (Week 5)

**Branch**: `phase-5-optimization` (off `phase-4-enhanced-tools`)  
**PR**: → `phase-4-enhanced-tools` (stacked on Phase 4)

### Goals
- Improve performance
- Add caching layer
- Enhance error handling
- Implement retries and backoff
- Implement user preferences system

### Tasks

#### 5.1 Caching

**Implementation**:
- [ ] Create `src/cache/cache.ts` with generic Cache<K, V> class
- [ ] Implement TTL (time-to-live) expiration logic
- [ ] Add get/set/delete/clear methods
- [ ] Add automatic cleanup of expired entries
- [ ] Cache PR metadata with 30s TTL
- [ ] Cache check runs with 10s TTL
- [ ] Cache comment data with 60s TTL
- [ ] Add cache hit/miss metrics logging
- [ ] Implement manual cache invalidation
- [ ] Add cache warming for common queries

**Unit Tests**:
- [ ] Test cache set and get
- [ ] Test TTL expiration (entries removed after TTL)
- [ ] Test cache invalidation
- [ ] Test cache clearing
- [ ] Test concurrent access
- [ ] Test cache hit/miss tracking

**Acceptance**:
- [ ] All tests pass
- [ ] Cache reduces API calls by >50% in typical usage
- [ ] TTL correctly expires entries
- [ ] No memory leaks with expired entries

**Key Files**:
- `src/cache/cache.ts`

#### 5.2 Rate Limiting

**Implementation**:
- [ ] Create `src/github/rate-limiter.ts` with RateLimiter class
- [ ] Track remaining API requests from response headers
- [ ] Track rate limit reset time
- [ ] Implement exponential backoff (1s, 2s, 4s, 8s)
- [ ] Queue requests when near limit (<100 remaining)
- [ ] Implement priority queue (critical requests first)
- [ ] Add request throttling (max concurrent requests)
- [ ] Warn when approaching rate limit
- [ ] Automatically retry on 429 (rate limit exceeded)
- [ ] Add rate limit status reporting

**Unit Tests**:
- [ ] Test tracking remaining requests
- [ ] Test exponential backoff timing
- [ ] Test request queuing when near limit
- [ ] Test priority queue ordering
- [ ] Test 429 retry logic
- [ ] Test concurrent request limiting

**Acceptance**:
- [ ] All tests pass
- [ ] Never hits rate limit in normal usage
- [ ] Exponential backoff works correctly
- [ ] Priority requests processed first

**Key Files**:
- `src/github/rate-limiter.ts`

#### 5.3 Parallel Requests

**Implementation**:
- [ ] Identify independent API calls that can run in parallel
- [ ] Replace sequential awaits with Promise.all where safe
- [ ] Batch related GitHub API calls:
  - [ ] Fetch PR + check runs in parallel
  - [ ] Fetch review comments + issue comments in parallel
  - [ ] Fetch multiple PRs in parallel for stack analysis
- [ ] Implement request pooling to limit concurrency
- [ ] Add performance timing logging
- [ ] Measure before/after performance
- [ ] Document performance improvements in comments

**Unit Tests**:
- [ ] Test parallel fetch logic
- [ ] Test request pooling limits concurrency
- [ ] Test error handling when one parallel request fails
- [ ] Mock timing to verify parallel execution

**Acceptance**:
- [ ] All tests pass
- [ ] Tool execution time reduced by >30%
- [ ] No race conditions from parallel requests
- [ ] Error in one request doesn't break others

#### 5.4 Error Recovery

**Implementation**:
- [ ] Create `src/github/retry.ts` with retry logic
- [ ] Implement retry for transient failures (3 attempts max)
- [ ] Use exponential backoff between retries
- [ ] Identify retryable errors:
  - [ ] 5xx server errors
  - [ ] Network timeouts
  - [ ] Rate limit errors (429)
  - [ ] Temporary GitHub outages
- [ ] Do NOT retry:
  - [ ] 4xx client errors (bad request, not found, unauthorized)
  - [ ] Validation errors
  - [ ] Authentication errors
- [ ] Implement graceful degradation when API unavailable
- [ ] Improve error messages with context and suggestions
- [ ] Add error codes for programmatic handling
- [ ] Log all retries for debugging

**Unit Tests**:
- [ ] Test successful retry after transient failure
- [ ] Test max retries reached
- [ ] Test exponential backoff timing
- [ ] Test retryable vs non-retryable error classification
- [ ] Test graceful degradation
- [ ] Test error message quality

**Acceptance**:
- [ ] All tests pass
- [ ] Transient failures auto-recover
- [ ] Non-retryable errors fail fast
- [ ] Error messages are helpful

#### 5.5 User Preferences System

**Reference**: See [PREFERENCE_HINTS.md](./PREFERENCE_HINTS.md) for full spec

**Implementation**:
- [ ] Create `src/preferences/loader.ts` with PreferencesLoader class
- [ ] Implement loadUserPreferences(toolName) method
- [ ] Implement saveUserPreferences(toolName, prefs) method
- [ ] Create config directory (~/.resolve-pr-mcp/)
- [ ] Handle missing config file gracefully (return {})
- [ ] Parse JSON config file safely
- [ ] Create `src/preferences/resolver.ts` with resolveParameterValue function
- [ ] Implement 3-level precedence:
  - [ ] Level 1: Explicit argument (always wins)
  - [ ] Level 2: User preference (if no explicit arg)
  - [ ] Level 3: Tool default (fallback)
- [ ] Verify 💾 emoji hints already in all schemas from Phase 3
- [ ] Update all 8 tool handlers to use resolveParameterValue:
  - [ ] get_failing_tests: bail_on_first, page_size, wait
  - [ ] find_unresolved_comments: include_bots, page_size, sort
  - [ ] manage_stacked_prs: auto_fix, use_onto, page_size
  - [ ] (Phase 4 tools as applicable)
- [ ] Add CLI command to manage preferences:
  - [ ] `resolve-pr-mcp preferences set <tool> <param> <value>`
  - [ ] `resolve-pr-mcp preferences get <tool> [param]`
  - [ ] `resolve-pr-mcp preferences clear <tool>`
  - [ ] `resolve-pr-mcp preferences list`
- [ ] Ensure explicit args always override preferences

**Unit Tests** (tests/preferences/):
- [ ] Test resolveParameterValue with explicit arg (wins)
- [ ] Test resolveParameterValue with user preference (used)
- [ ] Test resolveParameterValue with no pref (uses default)
- [ ] Test PreferencesLoader load from file
- [ ] Test PreferencesLoader save to file
- [ ] Test PreferencesLoader handles missing file
- [ ] Test PreferencesLoader handles invalid JSON
- [ ] Test precedence: explicit > pref > default

**Integration Tests**:
- [ ] Test real preferences file creation
- [ ] Test preferences persist across tool calls
- [ ] Test explicit args override preferences

**CLI Tests**:
- [ ] Test `preferences set` command
- [ ] Test `preferences get` command
- [ ] Test `preferences list` command
- [ ] Test `preferences clear` command
- [ ] Test invalid preference values rejected

**Acceptance**:
- [ ] All tests pass
- [ ] Can set preferences via CLI
- [ ] Preferences loaded in tool handlers
- [ ] Explicit args always override
- [ ] Config file created in ~/.resolve-pr-mcp/

**Key Files**:
- `src/preferences/loader.ts`
- `src/preferences/resolver.ts`
- `~/.resolve-pr-mcp/preferences.json` (user file)

---

## Phase 6: Polish (Week 6)

**Branch**: `phase-6-polish` (off `phase-5-optimization`)  
**PR**: → `phase-5-optimization` (stacked on Phase 5)

### Goals
- Complete documentation
- Add usage examples
- Create deployment guides
- Performance benchmarks

### Tasks

#### 6.1 Documentation

**Implementation**:
- [x] Architecture overview (ARCHITECTURE.md)
- [x] API specifications (API_DESIGN.md)
- [ ] Create USER_GUIDE.md with step-by-step tutorials
- [ ] Add "Getting Started" section with first-time setup
- [ ] Add common workflow examples
- [ ] Create TROUBLESHOOTING.md with FAQs and solutions:
  - [ ] GITHUB_TOKEN issues
  - [ ] Rate limiting problems
  - [ ] PR not found errors
  - [ ] CI timeout issues
- [ ] Update CONTRIBUTING.md with development guide:
  - [ ] How to add new tools
  - [ ] Testing requirements
  - [ ] Code style guidelines
  - [ ] PR process
- [ ] Update README.md with:
  - [ ] Installation instructions
  - [ ] Quick start guide
  - [ ] All 8 tools documented
  - [ ] MCP and CLI usage examples
  - [ ] Configuration options
- [ ] Add inline code comments for complex logic
- [ ] Ensure all public APIs have JSDoc comments

**Acceptance**:
- [ ] All docs reviewed and accurate
- [ ] README is clear and complete
- [ ] New users can get started in <5 minutes
- [ ] Troubleshooting guide covers common issues

#### 6.2 Examples

**Implementation**:
- [ ] Create examples/ directory with sample workflows
- [ ] Add example AI prompts for each tool:
  - [ ] "Check if my PR is ready to merge"
  - [ ] "Find all unresolved comments on PR #123"
  - [ ] "Help me rebase my stacked PR after upstream merged"
- [ ] Add complete workflow examples:
  - [ ] Daily PR review workflow
  - [ ] Stacked PR management workflow
  - [ ] CI failure debugging workflow
  - [ ] Pre-merge checklist workflow
- [ ] Create MCP_INTEGRATION.md:
  - [ ] Claude Desktop setup instructions
  - [ ] Config file example
  - [ ] Testing MCP connection
  - [ ] Troubleshooting MCP issues
- [ ] Add integration guides for other MCP clients:
  - [ ] Continue.dev integration
  - [ ] Custom MCP client integration
- [ ] Record video demos (optional):
  - [ ] Getting started screencast
  - [ ] Full workflow demo

**Acceptance**:
- [ ] All example prompts work as documented
- [ ] Workflows are realistic and useful
- [ ] MCP integration guide enables setup in <10 minutes
- [ ] Examples cover all 8 tools

#### 6.3 Deployment

**Implementation**:
- [ ] Prepare for npm package publication:
  - [ ] Verify package.json metadata (name, description, keywords)
  - [ ] Add repository, bugs, homepage URLs
  - [ ] Verify files field includes only necessary files
  - [ ] Test npm pack locally
  - [ ] Create .npmignore if needed
- [ ] Set up GitHub Actions workflow for releases:
  - [ ] Create `.github/workflows/release.yml`
  - [ ] Trigger on tag push (v*.*.*)
  - [ ] Run all tests before release
  - [ ] Build and publish to npm
  - [ ] Create GitHub release with changelog
- [ ] Version management:
  - [ ] Use semantic versioning (semver)
  - [ ] Update CHANGELOG.md with release notes
  - [ ] Tag releases in git
- [ ] Create release documentation:
  - [ ] RELEASE.md with release process
  - [ ] Migration guides for breaking changes
- [ ] Create Dockerfile (optional):
  - [ ] Multi-stage build
  - [ ] Minimal Alpine base image
  - [ ] Include only runtime dependencies

**Acceptance**:
- [ ] Can publish to npm successfully
- [ ] GitHub releases automated
- [ ] CHANGELOG is up to date
- [ ] Release process documented

#### 6.4 Monitoring and Observability

**Implementation**:
- [ ] Add structured logging:
  - [ ] Create `src/logging/logger.ts` with Winston or Pino
  - [ ] Log levels: error, warn, info, debug
  - [ ] JSON format for machine parsing
  - [ ] Include context: tool name, PR, timestamp
  - [ ] Add LOG_LEVEL environment variable
- [ ] Add metrics collection (optional):
  - [ ] Tool execution time per tool
  - [ ] GitHub API call count per tool
  - [ ] Cache hit/miss rates
  - [ ] Error rates by category
- [ ] Performance profiling:
  - [ ] Add performance.now() timing to handlers
  - [ ] Log slow operations (>1s)
  - [ ] Identify bottlenecks
  - [ ] Create performance benchmarks
- [ ] Usage analytics (opt-in):
  - [ ] Track tool usage frequency
  - [ ] Track parameter usage patterns
  - [ ] No PII or sensitive data
  - [ ] Opt-in via config flag only
- [ ] Error tracking:
  - [ ] Log all errors with stack traces
  - [ ] Categorize errors (github_api, validation, parsing, unknown)
  - [ ] Add error fingerprints for grouping

**Acceptance**:
- [ ] Structured logs are parsable
- [ ] Debug logs help troubleshoot issues
- [ ] Performance metrics identify slow paths
- [ ] No sensitive data logged
- [ ] Opt-in analytics work correctly

---

## Testing Strategy

**Reference**: See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for complete testing approach

**Coverage Goals**:
- [ ] Unit tests: >90% coverage
- [ ] Integration tests: >80% coverage
- [ ] Critical paths: 100% coverage
- [ ] All error scenarios tested
- [ ] Preference system tested

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation Tasks |
|------|------------------|
| **GitHub API rate limiting** | - [ ] Implement caching<br>- [ ] Request batching<br>- [ ] Priority queue |
| **Test log parsing failures** | - [ ] Support multiple frameworks<br>- [ ] Graceful degradation<br>- [ ] Confidence scoring |
| **Long-running CI waits** | - [ ] Timeout configuration<br>- [ ] Bail-on-first option<br>- [ ] Poll interval tuning |

### Operational Risks

| Risk | Mitigation Tasks |
|------|------------------|
| **Token permission issues** | - [ ] Validate on startup<br>- [ ] Clear error messages<br>- [ ] Document required scopes |
| **Large PR handling** | - [ ] Mandatory pagination<br>- [ ] Configurable page sizes<br>- [ ] Diff truncation |

---

## Success Metrics

### Functional Metrics
- [ ] CI/CD pipeline running on all PRs
- [ ] All 8 tools implemented and tested (3 core + 5 supplementary)
- [ ] Test coverage >85% overall
- [ ] All documented APIs work as specified
- [ ] User preferences system working
- [ ] Rebase strategy detection accurate

### Performance Metrics
- [ ] Average response time <2s (immediate mode)
- [ ] GitHub API usage <100 requests per tool invocation
- [ ] Memory usage <200MB under normal load

### Quality Metrics
- [ ] Zero critical bugs in production
- [ ] All error cases handled gracefully
- [ ] Documentation complete and accurate
- [ ] All preference hints in place

### User Experience Metrics
- [ ] Clear, actionable outputs
- [ ] Minimal token usage (validated with real usage)
- [ ] Efficient pagination working
- [ ] Helpful error messages

---

## Future Enhancements (Post-Launch)

**Advanced Features**:
- [ ] Multi-PR batch operations
- [ ] Custom workflow definitions
- [ ] Webhook integration for real-time updates
- [ ] Local git operations support

**AI Optimizations**:
- [ ] Semantic search across PR history
- [ ] Predictive conflict detection
- [ ] Automated fix suggestions
- [ ] Learning from fix success rates

**Enterprise Features**:
- [ ] Organization-wide analytics
- [ ] SAML/SSO integration
- [ ] Audit logging
- [ ] Team-level preferences

**Performance**:
- [ ] Persistent caching layer (Redis)
- [ ] GraphQL API usage where beneficial
- [ ] Request deduplication
- [ ] Streaming responses for large datasets

