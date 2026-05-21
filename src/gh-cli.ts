/**
 * gh-cli.ts — Wrapper for GitHub CLI (gh) commands.
 *
 * This module provides a thin wrapper around the gh CLI tool, harmonizing
 * the tv commands with native git and gh commands. It allows GitHub API
 * operations to be performed via the gh CLI instead of direct REST API calls.
 *
 * All functions spawn gh as a child process and parse its JSON output.
 */

import { execSync } from "child_process";

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
    execSync("gh --version", { stdio: "pipe", encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Escape an argument for safe shell execution on the current platform.
 * On Unix, uses single-quote escaping. On Windows, uses double-quote escaping.
 */
function escapeShellArg(arg: string): string {
  if (process.platform === "win32") {
    // Windows cmd.exe: use double quotes and escape special characters
    // Escape backslashes, double quotes, and percent signs
    const escaped = arg
      .replace(/\\/g, "\\\\")  // Backslash -> double backslash
      .replace(/"/g, '\\"');   // Double quote -> escaped double quote
    return `"${escaped}"`;
  } else {
    // Unix shells: use single quotes (safest for arbitrary strings)
    // Only need to escape single quotes: replace ' with '\''
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
}

/**
 * Run a gh command and return the output.
 * Throws GhCliError if the command fails.
 * Uses proper platform-specific argument escaping for security.
 */
function runGh(args: string[], env?: NodeJS.ProcessEnv): string {
  try {
    // Build command string with properly escaped arguments
    const cmdStr = ["gh", ...args].map(escapeShellArg).join(" ");
    
    return execSync(cmdStr, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : undefined,
      // Use shell: string path for Node.js compatibility
      // On Windows, this will use cmd.exe; on Unix, uses /bin/sh
      ...(process.platform === "win32" ? {} : { shell: "/bin/sh" }),
    } as any);
  } catch (err: unknown) {
    if (err instanceof Error) {
      const code = "status" in err ? (err.status as number) : 1;
      const stderr = "stderr" in err ? (err.stderr as string) : err.message;
      throw new GhCliError(`gh command failed: ${err.message}`, code, stderr);
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
        String(Math.min(maxRuns, 100)),
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
