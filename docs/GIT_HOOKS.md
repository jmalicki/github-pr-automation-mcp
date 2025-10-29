# Git Hooks Setup

This project uses client-side Git hooks to enforce code quality and commit standards.

## What's Included

### 🔧 Pre-commit Hook

- **Markdownlint**: Validates markdown files for consistency
- **ESLint**: Runs linting on staged TypeScript/JavaScript files
- **Auto-fix**: Automatically fixes linting issues when possible

### 📝 Commit Message Hook

- **Conventional Commits**: Enforces standard commit message format
- **Validation**: Rejects commits that don't follow the format

### 🏷️ Pre-push Hook

- **Version Tag Validation**: Ensures proper release process
- **File Checks**: Validates package.json and CHANGELOG.md exist

## Making Commits

### Interactive Commit (Recommended)

```bash
npm run commit
```

This opens an interactive prompt to help you create properly formatted commits.

### Manual Commit

```bash
git commit -m "feat: add new feature"
```

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to our CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit
- `release`: Release-related changes

### Examples

```bash
feat: add new MCP tool for PR analysis
fix: resolve GitHub API rate limiting issue
docs: update installation instructions
chore: update dependencies
```

## Markdown Linting

Markdown files are automatically linted for:

- Line length (120 characters)
- Consistent formatting
- Proper heading structure
- Link validation

### Manual Markdown Linting

```bash
npm run lint:md        # Check markdown files
npm run lint:md:fix    # Fix markdown issues
```

## Version Tag Validation

When pushing version tags (e.g., `v1.2.3`), the pre-push hook ensures:

- `package.json` exists
- `docs/CHANGELOG.md` exists

### Proper Release Process

```bash
# Use the release script (recommended)
npm run release:patch  # or minor/major

# This will:
# 1. Update package.json version
# 2. Update CHANGELOG.md
# 3. Run tests and linting
# 4. Create git tag
# 5. Push to GitHub
```

## Bypassing Hooks

### Skip Pre-commit Checks

```bash
git commit --no-verify -m "fix: emergency hotfix"
```

### Skip All Hooks

```bash
git push --no-verify
```

**Note**: Only use `--no-verify` in emergency situations.

## Troubleshooting

### Commit Message Rejected

If your commit message is rejected, check the format:

```bash
# Wrong
git commit -m "Added new feature"

# Correct
git commit -m "feat: add new feature"
```

### Markdown Linting Failed

```bash
# Check what's wrong
npm run lint:md

# Fix automatically
npm run lint:md:fix
```

### Hook Not Running

If hooks aren't running:

```bash
# Reinstall hooks
npm run prepare

# Check hook permissions
ls -la .husky/
```
