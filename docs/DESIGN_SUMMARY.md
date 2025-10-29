# Design Phase Summary

## Overview

Comprehensive design documentation has been completed for the **Resolve PR MCP Server** - an AI-powered GitHub Pull Request management system.

## What Was Created

### Project Structure

```
resolve-pr-mcp/
├── package.json                    # Node.js project configuration
├── tsconfig.json                   # TypeScript configuration
├── README.md                       # Main documentation
├── .gitignore                      # Git ignore rules
└── docs/                          # Comprehensive design docs
    ├── INDEX.md                   # Documentation overview
    ├── DESIGN_DECISIONS.md        # Key design choices & rationale
    ├── ARCHITECTURE.md            # System architecture
    ├── API_DESIGN.md              # Complete API specs (8 tools)
    ├── DATA_MODELS.md             # TypeScript type definitions
    ├── IMPLEMENTATION_PLAN.md     # Development roadmap with [ ] checkboxes
    ├── GITHUB_INTEGRATION.md      # GitHub API patterns
    ├── TESTING_STRATEGY.md        # Test approach & examples
    ├── USAGE_EXAMPLES.md          # Real-world workflows
    ├── PREFERENCE_HINTS.md        # User preference system (💾)
    └── AI_DECISION_GUIDE.md       # AI agent decision trees
```

**Total Documentation**: 11 comprehensive documents

## Core Tools Designed

### 1. get_failing_tests

**Purpose**: Analyze PR CI failures and provide targeted fix instructions

**Key Features**:

- ✅ Wait for CI completion or return immediately
- ✅ Bail on first failure for fast feedback
- ✅ Parse multiple test framework outputs (Jest, pytest, Go, RSpec)
- ✅ Generate reproduction commands
- ✅ Paginated results with prioritization

**Unique Value**: Extracts exact failing tests from CI logs instead of making AI parse raw logs

### 2. find_unresolved_comments

**Purpose**: Find unresolved PR comments and return raw data for LLM analysis

**Key Features**:

- ✅ Fetches all comment types (review, issue, inline)
- ✅ Builds conversation threads
- ✅ Includes bot comments by default (LLM filters)
- ✅ Returns raw data with reactions, author info
- ✅ Sort by chronological, file, or author

**Design Update**: Tool provides **raw data only** - LLM handles categorization and response generation

### 3. manage_stacked_prs

**Purpose**: Automate rebase and testing of stacked (dependent) PRs

**Key Features**:

- ✅ Verifies PR dependency chains
- ✅ Detects when rebase is needed
- ✅ Generates step-by-step rebase commands
- ✅ Integrates with get_failing_tests for automated fix loops
- ✅ Risk assessment and conflict prediction

**Unique Value**: Automates tedious stacked PR maintenance with AI-driven fix loops

## Supplementary Tools Designed

4. **detect_merge_conflicts** - Proactive conflict detection
5. **check_merge_readiness** - Comprehensive merge validation
6. **analyze_pr_impact** - Change impact analysis
7. **get_review_suggestions** - AI-optimized review context
8. **rebase_after_squash_merge** - Clean rebase using `--onto` after upstream squash-merge

**Note on #8**: This tool solves a specific but common problem: when an upstream PR in your stack gets squash-merged, regular `git rebase` tries to replay those commits (causing conflicts). This tool uses `git rebase --onto` to skip the upstream commits entirely and only rebase YOUR commits, resulting in a clean rebase with minimal conflicts.

These supplementary tools enhance the core workflow but are considered lower priority than the core 3 tools.

## Key Design Decisions

### 1. PR Identifier Format ✅

**Decision**: Use single string `"owner/repo#123"`

- More concise for AI agents
- Supports multiple formats (URLs, etc.)
- Human-friendly

### 2. Tool Responsibilities ✅

**Decision**: Tools provide raw data, LLMs analyze

- Tools: Fetch and structure GitHub data
- LLMs: Categorize, prioritize, generate responses
- Better separation of concerns
- More accurate results (LLM understands context)

**Example**: Tool returns comment text and metadata → LLM determines if it's "blocking", "nit", or "question"

### 3. Bot Filtering ✅

**Decision**: Include bots by default

- Neutral default - no assumptions
- LLM can filter based on content
- User can explicitly exclude via `exclude_authors`

### 4. Pagination ✅

**Decision**: Mandatory with sensible defaults

- Token efficiency (don't return 500 comments at once)
- Default sizes: 10 for tests, 20 for comments, 5 for commands
- Progressive disclosure

### 5. Wait vs. Immediate ✅

**Decision**: Support both, default to immediate

- Fast responses by default (<2s)
- Wait mode for convenience (CI polling)
- Bail-on-first for rapid feedback

## Architecture Highlights

### Dual Mode: MCP (stdio) + CLI

**Primary: MCP Server (stdio)**

- ✅ No HTTP server, no ports, no daemon
- ✅ MCP client spawns as subprocess
- ✅ Communicates via stdin/stdout (JSON-RPC)
- ✅ Process lifecycle managed by client

**Bonus: CLI Mode**

- ✅ Direct command-line invocation
- ✅ Perfect for testing and scripting
- ✅ CI/CD integration
- ✅ JSON or human-readable output

```bash
# MCP mode (primary)
node dist/index.js  # stdio transport for AI agents

# CLI mode (testing/automation)
resolve-pr-mcp get-failing-tests --pr "owner/repo#123" --json
```

### Layer Structure

```
AI Agent (Claude Desktop/etc)
      ↓ Spawns subprocess
MCP Server Process (node dist/index.js)
      ↓ stdio/JSON-RPC (not HTTP!)
Tool Handlers Layer (Input validation, pagination, formatting)
      ↓
GitHub Integration Layer (CI status, comments, PR analysis)
      ↓
Octokit Client (Rate limiting, auth, requests)
      ↓
GitHub API (HTTPS)
```

### Design Principles

1. **Token Efficiency**: Pre-filter and structure data to minimize AI token usage
2. **Actionability**: Return commands and instructions, not just observations
3. **Incremental Processing**: Mandatory pagination with sensible defaults
4. **Fail-Fast**: Bail on first failure for rapid iteration
5. **Stateless**: No session state, each call independent

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

- Project setup and MCP server skeleton
- GitHub API client wrapper
- Core utilities (parser, pagination, formatting)

### Phase 2: Core Tools (Weeks 2-3)

- Implement get_failing_tests (with log parsers)
- Implement find_unresolved_comments (with thread analysis)
- Implement manage_stacked_prs (with command generation)

### Phase 3: Enhanced Tools (Week 4)

- Conflict detection
- Merge readiness checks
- Impact analysis
- Review suggestions

### Phase 4: Optimization (Week 5)

- Caching layer
- Rate limiting improvements
- Error recovery
- Performance tuning

### Phase 5: Polish (Week 6)

- Complete documentation
- Usage examples
- Deployment tooling
- Performance benchmarks

**Estimated Total**: 6 weeks to production-ready v1.0

## Testing Strategy

### Coverage Targets

- Unit tests: >90% coverage
- Integration tests: >80% coverage
- Critical paths: 100% coverage

### Test Organization

```
tests/
├── fixtures/          # Mock GitHub API responses
│   ├── pull-requests/
│   ├── check-runs/
│   ├── logs/
│   └── comments/
├── mocks/            # Mock implementations
│   └── github-client.ts
├── unit/             # Unit tests
├── integration/      # Integration tests
└── e2e/             # End-to-end tests (optional)
```

### Key Test Scenarios

- 15+ scenarios per core tool
- All error cases covered
- Pagination edge cases
- Rate limiting simulation

## Documentation Quality

### Comprehensive Coverage

- **11 design documents** covering all aspects
- **Real-world examples** for every tool
- **Complete API specifications** with TypeScript types
- **Implementation plan** with [ ] checkboxes
- **Testing strategy** with example tests
- **User preference system** with 💾 hints
- **AI decision guides** for complex scenarios

### Key Documentation Files

1. **[INDEX.md](docs/INDEX.md)** - Navigation hub
2. **[DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md)** - 9 key decisions with rationale
3. **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture (stdio + CLI)
4. **[API_DESIGN.md](docs/API_DESIGN.md)** - 8 tools fully specified
5. **[DATA_MODELS.md](docs/DATA_MODELS.md)** - Complete TypeScript type definitions
6. **[IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)** - 6-week roadmap with checkboxes
7. **[GITHUB_INTEGRATION.md](docs/GITHUB_INTEGRATION.md)** - GitHub API patterns
8. **[TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)** - Testing approach
9. **[USAGE_EXAMPLES.md](docs/USAGE_EXAMPLES.md)** - 7+ workflow examples
10. **[PREFERENCE_HINTS.md](docs/PREFERENCE_HINTS.md)** - User preference system
11. **[AI_DECISION_GUIDE.md](docs/AI_DECISION_GUIDE.md)** - AI agent decision trees

## What's Next

### Ready for Implementation ✅

All design phase deliverables are complete:

- ✅ Architecture defined
- ✅ APIs specified  
- ✅ Data models documented
- ✅ Implementation plan created
- ✅ Testing strategy defined
- ✅ Examples provided

### To Start Development

1. **Initialize dependencies**: `npm install`
2. **Follow Phase 1** in [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
3. **Reference designs** as you implement
4. **Write tests** per [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)

### Key Implementation Files to Create

```
src/
├── index.ts                       # MCP server entry point
├── server.ts                      # Server configuration
├── types/                         # Type definitions
├── github/                        # GitHub API layer
│   ├── client.ts
│   ├── ci-status-fetcher.ts
│   ├── comment-manager.ts
│   └── pr-analyzer.ts
├── tools/                         # Tool handlers
│   ├── get-failing-tests/
│   ├── find-unresolved-comments/
│   └── manage-stacked-prs/
└── utils/                         # Utilities
    ├── parser.ts
    ├── pagination.ts
    └── formatting.ts
```

## Success Metrics

### Functional

- All 7 core tools implemented
- >85% test coverage
- All APIs work as specified

### Performance

- Average response <2s (immediate mode)
- <100 GitHub API calls per tool invocation
- <200MB memory usage

### Quality

- Zero critical bugs
- All error cases handled
- Complete documentation

## Questions Addressed

### Q: PR identifier - single string or separate fields?

**A**: Single string `"owner/repo#123"` - more AI-friendly, supports multiple formats

### Q: Should we filter bots by default?

**A**: No - include by default, let LLM filter based on content

### Q: What should find_unresolved_comments return?

**A**: Raw data only - LLM handles categorization, severity, response generation

## Conclusion

The design phase is **complete and comprehensive**. The project is ready for implementation with:

- ✅ Clear architecture
- ✅ Detailed specifications  
- ✅ Complete type definitions
- ✅ Step-by-step implementation plan
- ✅ Testing strategy
- ✅ Real-world examples
- ✅ Future roadmap

**Total Documentation**: 11 comprehensive documents providing complete guidance from design through deployment, including implementation checklists.

---

**Ready to implement!** 🚀

Start with [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) Phase 1.
