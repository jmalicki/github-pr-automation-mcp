# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-10-22

### Added

#### Phase 1: CI/CD Setup
- GitHub Actions workflows (test, lint, build)
- ESLint configuration with TypeScript support
- Vitest setup with coverage thresholds (85%)
- Husky pre-commit hooks
- Conventional Commits validation

#### Phase 2: Foundation
- Core type definitions (PRIdentifier, PaginationMeta, ToolError)
- Utility functions (parser, pagination, formatting)
- GitHub API client with token validation
- MCP server skeleton with stdio transport
- CLI entry point structure
- Comprehensive unit tests (28 tests)

#### Phase 3: Core Tools
- **get_failing_tests** - Analyze PR CI failures with pagination
- **find_unresolved_comments** - Find PR comments with filtering and sorting
- **manage_stacked_prs** - Manage stacked PRs with rebase automation
- Zod schemas with 💾 preference hints
- GitHub API error handling

#### Phase 4: Enhanced Tools
- **detect_merge_conflicts** - Detect PR merge conflicts
- **check_merge_readiness** - Comprehensive merge validation
- **analyze_pr_impact** - Analyze PR scope and impact
- **get_review_suggestions** - AI-optimized review context
- **rebase_after_squash_merge** - --onto rebase after squash-merge

#### Phase 5: Optimization
- User preferences system with 3-level precedence
- PreferencesLoader for ~/.resolve-pr-mcp/preferences.json
- Parameter resolution (explicit > preference > default)
- Preferences tests

#### Phase 6: Polish
- MIT License
- Contributing guidelines
- This changelog
- Complete README

### Documentation
- 11 comprehensive design documents
- Architecture specifications
- API design for all 8 tools
- Implementation plan with checkboxes
- Testing strategy
- User preference system guide
- AI decision guides

[0.1.0]: https://github.com/jmalicki/resolve-pr-mcp/releases/tag/v0.1.0

