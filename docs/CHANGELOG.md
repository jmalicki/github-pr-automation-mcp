# Changelog

All notable changes to GitHub PR Automation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2025-10-27

## [0.1.1] - 2025-10-22

### Added
- Comprehensive release workflow with automated npm publishing
- GitHub Actions workflows for releases and pre-releases
- Release automation scripts for version management
- MCP-specific metadata in package.json
- Pre-release support with alpha/beta/rc tags
- Automated changelog updates during releases
- Enhanced package.json with MCP server capabilities
- Release scripts for patch, minor, major, and prerelease versions

### Changed
- CLI binary name from `resolve-pr-mcp` to `github-pr-automation`
- Package name and description for better discoverability
- Documentation references to use new project name
- Added MCP-specific keywords for better marketplace discovery
- Enhanced package.json with MCP server metadata

## [0.1.0] - 2025-01-22

### Added
- Initial release of GitHub PR Automation
- MCP server implementation with 8 core tools
- CLI mode for direct tool usage
- Comprehensive test suite with unit and integration tests
- Server-side pagination for all tools
- Rate limiting and caching for GitHub API
- Parallel request handling for performance
- User preference system with AI agent learning
- Complete documentation suite

### Core Tools
- `get_failing_tests` - Analyze PR CI failures and get fix instructions
- `find_unresolved_comments` - Find and manage unresolved PR comments
- `manage_stacked_prs` - Automated stacked PR management with rebase strategies
- `detect_merge_conflicts` - Proactive conflict detection
- `check_merge_readiness` - Comprehensive PR health checks
- `analyze_pr_impact` - Code change impact analysis
- `get_review_suggestions` - AI-ready review context generation
- `rebase_after_squash_merge` - Clean rebase after upstream squash-merge

### Features
- **MCP Server Mode**: Primary mode for AI agents via stdio communication
- **CLI Mode**: Direct command-line usage for testing and automation
- **GitHub Integration**: Full GitHub API integration with authentication
- **Pagination**: MCP-compliant cursor-based pagination for all tools
- **Performance**: In-memory caching, rate limiting, and parallel requests
- **Error Handling**: Comprehensive error handling with actionable suggestions
- **Type Safety**: Full TypeScript implementation with Zod validation
- **Testing**: Unit, integration, and CLI tests with coverage reporting

### Documentation
- Complete API documentation with examples
- Design decisions and architecture documentation
- Implementation plan with detailed phases
- Usage examples and workflows
- Development guidelines and contribution process

### Technical Details
- Built with TypeScript and Node.js 18+
- Uses @modelcontextprotocol/sdk for MCP implementation
- Integrates with GitHub API via @octokit/rest
- Zod for runtime type validation
- Vitest for testing with coverage reporting
- ESLint for code quality
- Husky for git hooks and commit validation

---

## Version History

- **v0.1.0** (2025-01-22) - Initial release with core functionality
- **v0.2.0** (Planned) - Enhanced tools and additional integrations
- **v1.0.0** (Planned) - Stable API and production-ready features

## Migration Guide

### From resolve-pr-mcp to github-pr-automation

If you were using the previous name:

1. **Update MCP server configuration**:
   ```json
   {
     "mcpServers": {
       "github-pr-automation": {
         "command": "node",
         "args": ["/path/to/github-pr-automation/dist/index.js"],
         "env": {
           "GITHUB_TOKEN": "your_github_token"
         }
       }
     }
   }
   ```

2. **Update CLI usage**:
   ```bash
   # Old
   resolve-pr-mcp get-failing-tests --pr "owner/repo#123"
   
   # New
   github-pr-automation get-failing-tests --pr "owner/repo#123"
   ```

3. **Update any scripts or automation** that reference the old binary name

## Breaking Changes

None in v0.1.0 - this is the initial release.

## Deprecations

None currently.

## Security

- All GitHub API interactions use secure HTTPS
- Personal access tokens are required for authentication
- No sensitive data is logged or stored
- Rate limiting prevents API abuse
- Input validation prevents injection attacks

## Performance

- In-memory caching reduces API calls
- Rate limiting respects GitHub API limits
- Parallel requests improve throughput
- Server-side pagination prevents memory issues
- Optimized for minimal token usage in AI contexts

## Dependencies

### Core Dependencies
- @modelcontextprotocol/sdk ^0.5.0
- @octokit/rest ^20.0.2
- @octokit/auth-app ^6.0.3
- commander ^11.1.0
- zod ^3.22.4

### Development Dependencies
- @types/node ^20.11.0
- @typescript-eslint/eslint-plugin ^6.19.0
- @typescript-eslint/parser ^6.19.0
- @vitest/coverage-v8 ^1.2.0
- eslint ^8.56.0
- husky ^8.0.3
- typescript ^5.3.3
- vitest ^1.2.0

## Support

- **Documentation**: [docs/](./docs/) directory
- **Issues**: [GitHub Issues](https://github.com/jmalicki/github-pr-automation/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jmalicki/github-pr-automation/discussions)
- **License**: MIT License
