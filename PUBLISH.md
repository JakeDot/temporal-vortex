# Publishing to npm

This package is configured to be published to the npm registry. Follow these steps to publish a new version:

## Prerequisites

1. You must have an npm account: https://www.npmjs.com/signup
2. Ensure you are logged in locally:
   ```bash
   npm login
   ```
   Enter your npm username, password, and email.

## Publishing Steps

### 1. Update Version in package.json

Update the version number in `package.json` following [semantic versioning](https://semver.org/):
- Patch version (0.1.X): Bug fixes
- Minor version (0.X.0): New features (backward compatible)
- Major version (X.0.0): Breaking changes

```bash
# Manually update package.json version, or use npm version command
npm version patch    # Bumps 0.1.0 -> 0.1.1
npm version minor    # Bumps 0.1.0 -> 0.2.0
npm version major    # Bumps 0.1.0 -> 1.0.0
```

### 2. Build and Test

Ensure the project builds and tests pass:

```bash
npm run build
npm test
npm run lint
```

### 3. Create a Package

Verify the package contents before publishing:

```bash
npm pack
```

This creates a `.tgz` file and shows what will be published. Review the file list to ensure:
- Only necessary files are included (primarily controlled by the `files` list in `package.json`; use `.npmignore` only if `files` is not set)
- `dist/` directory is present
- `package.json`, `README.md`, and `LICENSE` are included

### 4. Publish to npm

Publish the package to the npm registry:

```bash
npm publish
```

### 5. Verify Publication

Check that the package was published successfully:

```bash
npm view temporal-vortex
npm search temporal-vortex
```

Visit: https://www.npmjs.com/package/temporal-vortex

## Users Installing the Package

After publication, users can install the CLI globally:

```bash
npm install -g temporal-vortex
tv --help
```

Or locally in a project:

```bash
npm install temporal-vortex
npx tv --help
```

## Package Configuration

The package is configured with:

- **Name**: `temporal-vortex`
- **Main entry**: `dist/cli.js`
- **CLI command**: `tv` (global binary)
- **Repository**: https://github.com/JakeDot/temporal-vortex
- **License**: MIT
- **Files included**: `dist/`, `README.md`, `LICENSE`

See `package.json` for complete metadata.

## Troubleshooting

### Authentication Issues
If you encounter authentication errors:
```bash
npm logout
npm login
npm publish
```

### Package Name Already Taken
The package name must be unique on npm. If taken, either:
1. Use a scoped package: `@yourname/temporal-vortex`
2. Choose a different name and update `package.json`

### Files Not Being Included
If files are missing, check the `files` list in `package.json` first (`files` takes precedence over `.npmignore`). Update as needed and re-run `npm pack` to verify.

### Version Already Published
Each version can only be published once. Update the version number and publish again:
```bash
npm version patch
npm publish
```

## References

- [npm publish documentation](https://docs.npmjs.com/cli/publish)
- [npm package.json documentation](https://docs.npmjs.com/cli/configuring-npm/package-json)
- [Semantic versioning](https://semver.org/)
