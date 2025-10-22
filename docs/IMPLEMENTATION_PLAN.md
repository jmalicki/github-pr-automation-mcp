# Implementation Plan

## Phase Overview

The implementation is divided into 6 phases, each building on the previous:

1. **CI/CD Setup** - Establish automated testing and quality checks for all future PRs
2. **Foundation** - Core infrastructure and GitHub integration
3. **Core Tools** - Implement the 3 primary tools requested
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
             ├─ PR #4: Phase 4 - Enhanced Tools (stacked on Phase 3)
                 ├─ PR #5: Phase 5 - Optimization (stacked on Phase 4)
                     ├─ PR #6: Phase 6 - Polish (stacked on Phase 5)
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

**Phase 4**:
- Branch: `phase-4-enhanced-tools` (off `phase-3-core-tools`)
- PR: `phase-4-enhanced-tools` → `phase-3-core-tools`

**Phase 5**:
- Branch: `phase-5-optimization` (off `phase-4-enhanced-tools`)
- PR: `phase-5-optimization` → `phase-4-enhanced-tools`

**Phase 6**:
- Branch: `phase-6-polish` (off `phase-5-optimization`)
- PR: `phase-6-polish` → `phase-5-optimization`

### Merge Strategy

**As each phase completes**:
1. Merge Phase 1 → `main`
2. Update Phase 2's base to `main` (rebase or merge)
3. Merge Phase 2 → `main`
4. Update Phase 3's base to `main`
5. Continue pattern...

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
- [ ] Add commands for all 8 tools
- [ ] Implement JSON and human-readable output
- [ ] Add to package.json bin
- [ ] Test with `npm run cli`

**Dependencies**: 
- `commander` - CLI argument parsing

**Key Files**:
- `src/cli.ts` - CLI entry point
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

**Tasks**:
- [ ] Create schema with 💾 preference hints
- [ ] Implement `src/github/ci-status-fetcher.ts`
- [ ] Create log parsers for Jest, pytest, Go, RSpec
- [ ] Implement polling with bail-on-first logic
- [ ] Create instruction generator
- [ ] Implement main handler with pagination
- [ ] Add user preference support
- [ ] Write unit tests for log parsers (all frameworks)
- [ ] Write integration tests with mock GitHub API
- [ ] Write CLI tests (argument parsing, output formatting)
- [ ] Test with real PR

**Key Files**:
- `src/tools/get-failing-tests/schema.ts`
- `src/tools/get-failing-tests/handler.ts`
- `src/tools/get-failing-tests/log-parser.ts`
- `src/tools/get-failing-tests/instructions.ts`
- `src/github/ci-status-fetcher.ts`

### 3.2 Tool: find_unresolved_comments

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#2-find_unresolved_comments) for full spec

**Important**: Tool returns raw data only. LLM does categorization and response generation.

**Tasks**:
- [ ] Create schema with 💾 preference hints
- [ ] Implement `src/github/comment-manager.ts`
- [ ] Create thread analyzer (resolution heuristics only)
- [ ] Implement sorting by chronological/file/author
- [ ] Implement main handler with pagination
- [ ] Add user preference support
- [ ] Write unit tests for thread building
- [ ] Write integration tests with mock comments
- [ ] Write CLI tests (argument parsing, output formatting)
- [ ] Test with real PR

**Key Files**:
- `src/tools/find-unresolved-comments/schema.ts`
- `src/tools/find-unresolved-comments/handler.ts`
- `src/tools/find-unresolved-comments/thread-analyzer.ts`
- `src/github/comment-manager.ts`

### 3.3 Tool: manage_stacked_prs

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#3-manage_stacked_prs) and [AI_DECISION_GUIDE.md](./AI_DECISION_GUIDE.md) for rebase strategy

**Important**: Detect squash merges and recommend regular vs --onto rebase strategy

**Tasks**:
- [ ] Create schema with optional use_onto parameter
- [ ] Implement `src/github/pr-analyzer.ts` (stack validation)
- [ ] Implement rebase strategy detector (squash merge detection)
- [ ] Create command generator with --onto support
- [ ] Generate ASCII visualization of stack
- [ ] Implement main handler with strategy recommendation
- [ ] Add pagination for commands
- [ ] Add user preference support
- [ ] Write unit tests for stack validation
- [ ] Write tests for rebase strategy detection
- [ ] Write CLI tests (argument parsing, output formatting)
- [ ] Test with real stacked PRs

**Key Files**:
- `src/tools/manage-stacked-prs/schema.ts`
- `src/tools/manage-stacked-prs/handler.ts`
- `src/tools/manage-stacked-prs/command-generator.ts`
- `src/tools/manage-stacked-prs/rebase-strategy.ts`
- `src/github/pr-analyzer.ts`

### Phase 3 Deliverables
- [ ] All 3 core tools functional
- [ ] Comprehensive test coverage (>85%)
- [ ] Input validation working with Zod
- [ ] Pagination implemented and tested
- [ ] Error handling robust
- [ ] User preferences system integrated
- [ ] Rebase strategy detection working
- [ ] CI validates all tools

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

**Tasks**:
- [ ] Use GitHub's mergeable state API
- [ ] Implement dry-run merge detection if needed
- [ ] Parse conflict markers
- [ ] Generate resolution suggestions
- [ ] Write tests

### 4.2 Tool: check_merge_readiness

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#5-check_merge_readiness)

**Complexity**: Medium | **Priority**: High | **Time**: 1 day

**Tasks**:
- [ ] Check CI status (reuse from get_failing_tests)
- [ ] Check review approvals
- [ ] Check branch protection rules
- [ ] Verify no conflicts
- [ ] Ensure branch is up to date
- [ ] Write tests

### 4.3 Tool: analyze_pr_impact

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#6-analyze_pr_impact)

**Complexity**: High | **Priority**: Medium | **Time**: 2 days

**Tasks**:
- [ ] Analyze file changes
- [ ] Categorize by impact area (heuristics)
- [ ] Fetch file history for reviewer suggestions
- [ ] Find similar PRs (optional)
- [ ] Write tests

### 4.4 Tool: get_review_suggestions

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#7-get_review_suggestions)

**Complexity**: High | **Priority**: Medium | **Time**: 2 days

**Tasks**:
- [ ] Generate review checklist based on changes
- [ ] Extract relevant diff excerpts
- [ ] Identify focus points (security, performance keywords)
- [ ] Link related issues and PRs
- [ ] Write tests

### 4.5 Tool: rebase_after_squash_merge

**Reference**: See [API_DESIGN.md](./API_DESIGN.md#8-rebase_after_squash_merge)

**Complexity**: Medium | **Priority**: Medium | **Time**: 1 day

**Tasks**:
- [ ] Detect when upstream PR was squash-merged
- [ ] Identify last upstream commit before user's work
- [ ] Generate `git rebase --onto` command
- [ ] Provide before/after visualization
- [ ] Integrate with manage_stacked_prs
- [ ] Write tests

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

#### 4.1 Caching

**Tasks**:
- [ ] Implement in-memory cache with TTL
- [ ] Cache PR metadata (30s TTL)
- [ ] Cache check runs (10s TTL)
- [ ] Add cache invalidation logic
- [ ] Write tests

**Key Files**:
- `src/cache/cache.ts`

#### 4.2 Rate Limiting

**Tasks**:
- [ ] Track remaining GitHub API requests
- [ ] Implement exponential backoff
- [ ] Queue requests when near limit
- [ ] Add priority queue for critical requests
- [ ] Write tests

**Key Files**:
- `src/github/rate-limiter.ts`

#### 4.3 Parallel Requests

**Tasks**:
- [ ] Batch related GitHub API calls
- [ ] Use Promise.all for independent fetches
- [ ] Implement request pooling
- [ ] Measure performance improvements

#### 4.4 Error Recovery

**Tasks**:
- [ ] Retry transient failures (3 attempts)
- [ ] Implement exponential backoff
- [ ] Add graceful degradation
- [ ] Improve error messages
- [ ] Write error scenario tests

#### 4.5 User Preferences System

**Reference**: See [PREFERENCE_HINTS.md](./PREFERENCE_HINTS.md) for full spec

**Tasks**:
- [ ] Implement PreferencesLoader (load/save JSON)
- [ ] Implement resolveParameterValue function
- [ ] Add 💾 emoji hints to all tool schemas
- [ ] Update all tool handlers to use preferences
- [ ] Add CLI command to manage preferences
- [ ] Ensure explicit args always win
- [ ] Write preference resolution tests

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

#### 5.1 Documentation

**Tasks**:
- [x] Architecture overview (ARCHITECTURE.md)
- [x] API specifications (API_DESIGN.md)
- [ ] User guide with examples
- [ ] Troubleshooting guide
- [ ] Contributing guidelines
- [ ] Update README with usage

#### 5.2 Examples

**Tasks**:
- [ ] Example AI prompts for each tool
- [ ] Complete workflow examples
- [ ] Integration guide for Claude Desktop
- [ ] Integration guide for other MCP clients
- [ ] Video/screencast demos (optional)

#### 5.3 Deployment

**Tasks**:
- [ ] Create Dockerfile (optional)
- [ ] Prepare for npm package publication
- [ ] Set up GitHub Actions workflow for releases
- [ ] Version management and changelog
- [ ] Create release documentation

#### 5.4 Monitoring

**Tasks**:
- [ ] Add structured logging
- [ ] Add metrics collection (optional)
- [ ] Performance profiling
- [ ] Usage analytics (opt-in)
- [ ] Error tracking setup

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

