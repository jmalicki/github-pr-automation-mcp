# Contributing to Resolve PR MCP

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Run tests: `npm test`

## Development Workflow

Following our AI developer standards:

1. **Create a branch off main** for your changes
   ```bash
   git checkout main
   git pull
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** with tests
   - Write tests first (TDD)
   - Ensure tests include comments explaining what they test
   - Run `npm test` frequently

3. **Follow Conventional Commits**
   ```
   feat: add new feature
   fix: bug fix
   docs: documentation changes
   test: add or update tests
   refactor: code refactoring
   ```

4. **Ensure quality**
   ```bash
   npm run lint        # ESLint check
   npm run type-check  # TypeScript check
   npm test            # Run all tests
   npm run build       # Verify build succeeds
   ```

5. **Submit a pull request**
   - Keep PRs focused and single-concern
   - Link to related issues
   - CI must pass before merge

## File Renaming

When renaming or moving files, use `git mv` to preserve history:

```bash
git mv old-name.ts new-name.ts
```

## Testing Guidelines

- Tests must have human-readable comments explaining what they test
- Tests should reference requirements they validate
- Minimum 85% coverage for new code
- Test both success and error cases

## Code Style

- TypeScript strict mode
- ESLint enforced
- No console.log (use console.error or console.warn for important messages)
- Use meaningful variable names

## Questions?

Open an issue or check the documentation in `docs/`.

