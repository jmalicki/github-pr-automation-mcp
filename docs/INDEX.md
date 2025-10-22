# Documentation Index

Complete documentation for the Resolve PR MCP Server.

## Quick Start

1. **[README](../README.md)** - Installation, configuration, and quick reference
2. **[USAGE_EXAMPLES](./USAGE_EXAMPLES.md)** - Real-world workflows and examples

## Design Documentation

### Core Design

- **[DESIGN_PHILOSOPHY](./DESIGN_PHILOSOPHY.md)** ⭐ **START HERE** - Dumb tool, smart agent
  - What tool does vs. what agent does
  - Why we don't interpret data
  - Responsibility boundaries
  - Real-world examples

- **[DESIGN_DECISIONS](./DESIGN_DECISIONS.md)** - Key design choices and rationale
  - PR identifier format
  - Tool vs. LLM responsibilities
  - Bot filtering defaults
  - Pagination strategy
  - Error handling approach

- **[ARCHITECTURE](./ARCHITECTURE.md)** - System architecture overview
  - Layer responsibilities
  - Data flow diagrams
  - Performance considerations
  - Security model
  - Extensibility points

### API Specifications

- **[API_DESIGN](./API_DESIGN.md)** - Complete API specification
  - **Core Tools:**
    1. `get_failing_tests` - CI failure analysis
    2. `find_unresolved_comments` - Comment management
    3. `manage_stacked_prs` - Stacked PR automation
  - **Supplementary Tools:**
    4. `detect_merge_conflicts` - Conflict detection
    5. `check_merge_readiness` - Merge validation
    6. `analyze_pr_impact` - Impact analysis
    7. `get_review_suggestions` - Review context
  - Input/output schemas for all tools
  - Error response formats
  - Common patterns

- **[DATA_MODELS](./DATA_MODELS.md)** - Type definitions
  - Core types (PRIdentifier, PaginationMeta)
  - Tool-specific models
  - GitHub API response types
  - Error models
  - Utility types

## Implementation Guidance

- **[IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md)** - Development roadmap
  - Phase 1: Foundation (Week 1)
  - Phase 2: Core Tools (Weeks 2-3)
  - Phase 3: Enhanced Tools (Week 4)
  - Phase 4: Optimization (Week 5)
  - Phase 5: Polish (Week 6)
  - Detailed task breakdown for each phase
  - Risk mitigation strategies
  - Success metrics

- **[GITHUB_INTEGRATION](./GITHUB_INTEGRATION.md)** - GitHub API integration
  - Authentication and token setup
  - Rate limiting strategy
  - API endpoint reference
  - Common integration patterns
  - Error handling examples
  - Performance optimization

- **[TESTING_STRATEGY](./TESTING_STRATEGY.md)** - Testing approach
  - Test categorization (unit, integration, E2E)
  - Fixture organization
  - Mock implementations
  - Coverage requirements
  - Test scenarios for each tool
  - CI/CD integration

- **[PREFERENCE_HINTS](./PREFERENCE_HINTS.md)** - User preference system
  - Schema annotations for preference-worthy parameters
  - AI agent learning patterns
  - Optional config file support
  - Examples by tool

- **[AI_DECISION_GUIDE](./AI_DECISION_GUIDE.md)** - Guide for AI agents
  - When to use `--onto` for rebasing
  - Decision trees for rebase strategies
  - Error recovery patterns
  - Adaptive strategies

## Documentation Organization

```
docs/
├── INDEX.md                    # This file - documentation overview
├── DESIGN_DECISIONS.md         # Key design choices and rationale
├── ARCHITECTURE.md             # System architecture
├── API_DESIGN.md               # Complete API specification (8 tools)
├── DATA_MODELS.md              # Type definitions
├── IMPLEMENTATION_PLAN.md      # Development roadmap with checkboxes
├── GITHUB_INTEGRATION.md       # GitHub API patterns
├── TESTING_STRATEGY.md         # Testing approach
├── USAGE_EXAMPLES.md           # Real-world workflows
├── PREFERENCE_HINTS.md         # User preference system (💾)
└── AI_DECISION_GUIDE.md        # Guide for AI agents (rebase strategies)
```

## Reading Paths

### For First-Time Readers

1. Start with **[README](../README.md)** for overview and setup
2. Read **[DESIGN_DECISIONS](./DESIGN_DECISIONS.md)** to understand philosophy
3. Review **[API_DESIGN](./API_DESIGN.md)** for tool capabilities
4. Explore **[USAGE_EXAMPLES](./USAGE_EXAMPLES.md)** for practical workflows

### For Implementers

1. **[ARCHITECTURE](./ARCHITECTURE.md)** - Understand system structure
2. **[IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md)** - Follow development phases
3. **[DATA_MODELS](./DATA_MODELS.md)** - Reference type definitions
4. **[GITHUB_INTEGRATION](./GITHUB_INTEGRATION.md)** - Implement API calls
5. **[TESTING_STRATEGY](./TESTING_STRATEGY.md)** - Write tests

### For Users/Integrators

1. **[README](../README.md)** - Installation and configuration
2. **[API_DESIGN](./API_DESIGN.md)** - Tool capabilities reference
3. **[USAGE_EXAMPLES](./USAGE_EXAMPLES.md)** - Copy-paste workflows
4. **[DESIGN_DECISIONS](./DESIGN_DECISIONS.md)** - Understand behavior

### For Contributors

1. **[DESIGN_DECISIONS](./DESIGN_DECISIONS.md)** - Understand design philosophy
2. **[ARCHITECTURE](./ARCHITECTURE.md)** - System structure
3. **[IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md)** - Current phase and tasks
4. **[TESTING_STRATEGY](./TESTING_STRATEGY.md)** - Testing requirements

## Key Concepts

### Design Philosophy

1. **Token Efficiency**: Pre-process data to minimize AI token usage
2. **Actionability**: Return commands and instructions, not just data
3. **Tool/LLM Split**: Tools fetch data, LLMs analyze and decide
4. **Pagination**: Always paginate with sensible defaults
5. **Fail Fast**: Clear errors for user mistakes, retry for API issues

### Tool Categories

**Core Tools** (Requested):
- CI failure analysis
- Comment management
- Stacked PR automation

**Supplementary Tools** (Enhance workflow):
- Conflict detection
- Merge readiness checks
- Impact analysis
- Review context generation

### Common Patterns

- **PR Identifier**: `"owner/repo#123"` format
- **Pagination**: Mandatory with metadata
- **Wait Modes**: Immediate (default) vs. polling
- **Error Responses**: Categorized with suggestions
- **Raw Data**: Tools provide, LLMs analyze

## Quick Reference

### Tool Comparison

| Tool | Purpose | Wait Support | Pagination | Primary Output |
|------|---------|--------------|------------|----------------|
| `get_failing_tests` | Find CI failures | ✅ Yes | ✅ Yes | Test failures + instructions |
| `find_unresolved_comments` | List comments | ❌ No | ✅ Yes | Raw comments + metadata |
| `manage_stacked_prs` | Rebase stack | ⚠️ Via commands | ✅ Yes | Command sequence |
| `detect_merge_conflicts` | Find conflicts | ❌ No | ❌ No | Conflict list |
| `check_merge_readiness` | Validate merge | ❌ No | ❌ No | Readiness checklist |
| `analyze_pr_impact` | Assess changes | ❌ No | ❌ No | Impact summary |
| `get_review_suggestions` | Review context | ❌ No | ✅ Yes (files) | Review checklist |

### Default Pagination Sizes

- Test failures: 10 per page
- Comments: 20 per page
- Commands: 5 per page
- Files: 50 per page

### Authentication

- Required: `GITHUB_TOKEN` environment variable
- Scopes: `repo`, `read:org`
- Validation: On server startup

## Version History

- **v0.1.0** (Current) - Initial design phase
  - Complete API specifications
  - Design documentation
  - Implementation plan

## Contributing

When adding new documentation:

1. **Update this INDEX.md** to reference new documents
2. **Follow naming convention**: `SCREAMING_SNAKE_CASE.md`
3. **Include examples** where applicable
4. **Link between documents** for cross-references
5. **Update README** if user-facing changes

When updating existing documentation:

1. **Maintain consistency** across all documents
2. **Update all references** to changed APIs
3. **Version significant changes** in commit messages
4. **Test examples** to ensure they work

## Support

For questions or issues:

1. Check **[USAGE_EXAMPLES](./USAGE_EXAMPLES.md)** for common scenarios
2. Review **[DESIGN_DECISIONS](./DESIGN_DECISIONS.md)** for behavior rationale
3. Reference **[API_DESIGN](./API_DESIGN.md)** for specifications
4. Open an issue on GitHub with details

## License

MIT - See [LICENSE](../LICENSE) file

