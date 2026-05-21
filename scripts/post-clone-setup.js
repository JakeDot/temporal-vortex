#!/usr/bin/env node

/**
 * Post-clone setup script for temporal-vortex.
 * This script runs after cloning the repository to set up the development environment.
 * 
 * It performs the following tasks:
 * 1. Installs npm dependencies
 * 2. Configures git hooks
 * 3. Builds the TypeScript project
 * 4. Runs tests to verify the setup
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args, description) {
  log(`\n▶ ${description}...`, 'blue');
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    encoding: 'utf-8'
  });

  if (result.status !== 0) {
    log(`✗ ${description} failed`, 'red');
    return false;
  }

  log(`✓ ${description} completed`, 'green');
  return true;
}

async function setup() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║     temporal-vortex Post-Clone Setup                       ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    log('\n✗ package.json not found. Please run this script from the repository root.', 'red');
    process.exit(1);
  }

  // Check if we're in a git repository
  if (!fs.existsSync('.git')) {
    log('\n⚠ Not in a git repository. Skipping git hooks setup.', 'yellow');
  } else {
    // Configure git hooks
    const hooksResult = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    if (hooksResult.status === 0) {
      log('\n✓ Git hooks configured', 'green');
    } else {
      log('\n⚠ Failed to configure git hooks. You can set this manually:', 'yellow');
      log('  git config core.hooksPath .githooks', 'yellow');
    }
  }

  // Install dependencies
  if (!runCommand('npm', ['install'], 'Installing dependencies')) {
    log('\n✗ Setup failed during dependency installation', 'red');
    process.exit(1);
  }

  // Build the project
  if (!runCommand('npm', ['run', 'build'], 'Building TypeScript project')) {
    log('\n✗ Setup failed during build', 'red');
    process.exit(1);
  }

  // Run tests
  if (!runCommand('npm', ['test'], 'Running tests')) {
    log('\n⚠ Some tests failed, but setup is complete', 'yellow');
  }

  log('\n╔════════════════════════════════════════════════════════════╗', 'green');
  log('║     ✓ Setup Complete!                                      ║', 'green');
  log('╚════════════════════════════════════════════════════════════╝', 'green');
  log('\nYou can now start developing:', 'blue');
  log('  npm run build    - Build the TypeScript project', 'blue');
  log('  npm test         - Run tests', 'blue');
  log('  npm run lint     - Run ESLint', 'blue');
  log('  npm start        - Run the CLI in development mode', 'blue');
  log('  tv --help        - Show CLI help (after building)', 'blue');
}

setup().catch(error => {
  log(`\n✗ Setup failed: ${error.message}`, 'red');
  process.exit(1);
});

