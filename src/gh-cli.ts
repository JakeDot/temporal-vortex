/**
 * gh-cli.ts — Wrapper for GitHub CLI (gh) commands.
 *
 * This module provides a thin wrapper around the gh CLI tool, harmonizing
 * the tv commands with native git and gh commands. It allows GitHub API
 * operations to be performed via the gh CLI instead of direct REST API calls.
 *
 * All functions spawn gh as a child process and parse its JSON output.
 */

import { spawnSync } from "child_process";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GhCliError extends Error {
  constructor(
    message: string,
    public code: number,
    public stderr: string,
  ) {
    super(message);
    this.name = "GhCliError";
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check if gh CLI is available.
 * Returns true if gh can be executed, false otherwise.
 */
export function isGhAvailable(): boolean {
  try {
    const result = spawnSync("gh", ["--version"], {
      stdio: "pipe",
      encoding: "utf8",
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Run a gh command and return the output.
 * Throws GhCliError if the command fails.
 * Uses spawnSync to safely execute gh without shell interpretation.
 */
function runGh(args: string[], env?: NodeJS.ProcessEnv): string {
  try {
    const result = spawnSync("gh", args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : undefined,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new GhCliError(
        result.stderr.trim() || `gh command failed with exit code ${result.status}`,
        result.status ?? 1,
        result.stderr
      );
    }

    // Return stdout or stderr (some gh commands write to stderr)
    return result.stdout || result.stderr;
  } catch (err: unknown) {
    if (err instanceof GhCliError) {
      throw err;
    }
    if (err instanceof Error) {
      throw new GhCliError(`gh command failed: ${err.message}`, 1, err.message);
    }
    throw new GhCliError("gh command failed", 1, String(err));
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Get the authenticated user's login via gh auth status.
 * Useful for detecting if gh is properly authenticated.
 */
export function getAuthenticatedUser(): string | null {
  try {
    const output = runGh(["auth", "status"]);
    // Parse "Logged in to github.com as <username> ..."
    const match = output.match(/Logged in to \S+ as (\S+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GitHub API wrappers using gh cli
// ---------------------------------------------------------------------------

export interface GhIssueComment {
  id: number;
  body: string;
  createdAt: string;
  author: {
    login: string;
  };
  url: string;
  issue: {
    number: number;
    title: string;
    isPullRequest: boolean;
  };
}

export interface GhPRReviewComment {
  id: number;
  body: string;
  createdAt: string;
  author: {
    login: string;
  };
  url: string;
  commit: {
    oid: string;
  };
  pullRequest: {
    number: number;
  };
  path: string;
  line: number | null;
}

export interface GhPRReview {
  id: number;
  body: string;
  submittedAt: string | null;
  state: string;
  author: {
    login: string;
  };
  url: string;
  pullRequest: {
    number: number;
    title: string;
  };
}

export interface GhCommitComment {
  id: number;
  body: string;
  createdAt: string;
  author: {
    login: string;
  };
  url: string;
  commit: {
    oid: string;
  };
  path: string | null;
  line: number | null;
}

export interface GhWorkflowRun {
  databaseId: number;
  name: string | null;
  number: number;
  displayTitle: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  event: string;
  headBranch: string | null;
  headSha: string;
  actor: {
    login: string;
  };
  url: string;
}

/**
 * Fetch workflow runs for a repository using gh run list command.
 */
export function fetchWorkflowRunsWithGh(
  owner: string,
  repo: string,
  token?: string,
  maxRuns = 100,
): GhWorkflowRun[] | null {
  if (!isGhAvailable()) {
    return null;
  }

  try {
    const env = token ? { GH_TOKEN: token } : undefined;
    // Use gh run list command with JSON output
    const output = runGh(
      [
        "run",
        "list",
        "--repo",
        `${owner}/${repo}`,
        "--limit",
        String(Math.min(maxRuns, 1000)),
        "--json",
        "databaseId,name,number,displayTitle,status,conclusion,createdAt,startedAt,updatedAt,event,headBranch,headSha,actor,url",
      ],
      env,
    );
    return JSON.parse(output) as GhWorkflowRun[];
  } catch {
    return null;
  }
}

/**
 * Verify gh authentication and token validity.
 * Useful for ensuring a token is properly configured before operations.
 */
export function verifyAuthentication(token?: string): boolean {
  if (!isGhAvailable()) {
    return false;
  }

  try {
    const env = token ? { GH_TOKEN: token } : undefined;
    runGh(["api", "user"], env);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the GitHub host and login using gh auth status.
 * Returns an object with host and login if authenticated, null otherwise.
 */
export function getAuthStatus(token?: string): {
  host: string;
  login: string;
} | null {
  if (!isGhAvailable()) {
    return null;
  }

  try {
    const env = token ? { GH_TOKEN: token } : undefined;
    const output = runGh(["auth", "status"], env);
    // Parse the output to extract host and login
    // Example: "Logged in to github.com as octocat (keyring)"
    const match = output.match(/Logged in to (\S+) as (\S+)/);
    if (match) {
      return {
        host: match[1],
        login: match[2],
      };
    }
    return null;
  } catch {
    return null;
  }
}
