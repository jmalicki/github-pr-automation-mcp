# Version Validation Test

This test ensures that the version in `package.json` is always at least as recent as the latest git tag, preventing version regressions.

## What it does

The test (`tests/utils/version-validation.test.ts`) performs the following checks:

1. **Semantic Version Parsing**: Validates that version strings follow semantic versioning (semver) format
2. **Version Comparison**: Compares package.json version against the latest git tag
3. **Regression Detection**: Fails the test if package.json version is older than the latest git tag
4. **Edge Case Handling**: Handles prerelease versions, missing tags, and development versions

## How it works

### Version Comparison Logic

The test uses semantic version comparison:
- `1.0.0` < `2.0.0` (major version)
- `1.1.0` < `1.2.0` (minor version)  
- `1.0.1` < `1.0.2` (patch version)
- `1.0.0-alpha.1` < `1.0.0` (prerelease < release)

### Git Tag Detection

The test automatically detects the latest git tag using:
```bash
git tag --sort=-version:refname
```

### Error Handling

When a version regression is detected, the test:
1. Logs clear error messages
2. Explains what needs to be fixed
3. Fails the test with a descriptive error

## CI Integration

The test runs in GitHub Actions workflows:
- **Build workflow**: Runs early to catch version issues before build
- **Test workflow**: Runs as part of the full test suite

## Example Output

### ✅ Success Case
```
Package version: 0.3.1
Latest git tag: v0.3.0
✅ Package version is newer than latest tag
```

### ❌ Failure Case
```
Package version: 0.2.1
Latest git tag: v0.3.0
❌ Package version 0.2.1 is older than latest tag v0.3.0
This indicates a version regression. Please update package.json version to be at least as recent as the latest git tag.
```

## Fixing Version Regressions

When the test fails, update the version in `package.json` to be at least as recent as the latest git tag:

```bash
# Check current versions
git tag --sort=-version:refname | head -1
cat package.json | grep version

# Update package.json version (e.g., from 0.2.1 to 0.3.0 or higher)
npm version patch  # or minor/major
```

## Test Coverage

The test covers:
- ✅ Standard semantic versions (`1.2.3`)
- ✅ Versions with 'v' prefix (`v1.2.3`)
- ✅ Prerelease versions (`1.2.3-alpha.1`)
- ✅ Development versions (`0.0.0-dev`)
- ✅ Complex prerelease versions (`1.0.0-alpha.1+build.123`)
- ✅ Zero versions (`0.0.0`)
- ✅ Missing git tags (graceful handling)
- ✅ Invalid version formats (error handling)
