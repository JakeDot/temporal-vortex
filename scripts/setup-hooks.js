#!/usr/bin/env node

/**
 * Setup git hooks for the repository.
 * Configures core.hooksPath to point to .githooks directory.
 * Runs automatically via npm prepare script.
 */

const fs = require('fs');
const { spawnSync } = require('child_process');

try {
  // Only run if we're in a git repository
  if (!fs.existsSync('.git')) {
    process.exit(0);
  }

  // Configure git to use .githooks directory for hooks
  const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
    stdio: 'pipe',
    encoding: 'utf-8'
  });

  // Check if the command failed
  if (result.status !== 0 || result.error) {
    console.warn('⚠️  Warning: Failed to configure git hooks.');
    console.warn('   Run manually: git config core.hooksPath .githooks');
    process.exit(0); // Don't fail npm install
  }
} catch (error) {
  console.warn('⚠️  Warning: Failed to configure git hooks.');
  console.warn('   Run manually: git config core.hooksPath .githooks');
  process.exit(0); // Don't fail npm install
}
