#!/usr/bin/env node
/**
 * cli.ts — temporal-vortex command-line interface.
 *
 * Git commands:
 *   tv annotate <file>            Per-line timestamps (git blame)
 *   tv log [file]                 Commit history for a file or whole repo
 *   tv summary [path]             File-level timestamp statistics
 *
 * GitHub commands:
 *   tv github events <owner/repo> All timestamped GitHub events
 *   tv github workflows <owner/repo> Workflow runs (agent start/end)
 */

import { Command } from "commander";
import { blame, gitLog, summary } from "./git.js";
import { printBlame, printLog, printSummary } from "./formatter.js";
import {
  fetchAllGitHubEvents,
  fetchWorkflowRuns,
  type GitHubEventKind,
} from "./github.js";
import { printGitHubEvents, printWorkflowRuns } from "./github-formatter.js";

const program = new Command();

program
  .name("tv")
  .description("Extract change timestamps from a git repository")
  .version("0.1.0");

// ---------------------------------------------------------------------------
// annotate
// ---------------------------------------------------------------------------
program
  .command("annotate <file>")
  .description("Show per-line timestamps for a file (like git blame, focused on age)")
  .option("-r, --repo <path>", "path to the git repository", ".")
  .option("--no-author",       "omit author column")
  .action((file: string, opts: { repo: string; author: boolean }) => {
    try {
      const entries = blame(file, opts.repo);
      printBlame(entries, opts.author);
    } catch (err) {
      console.error(String(err));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// log
// ---------------------------------------------------------------------------
program
  .command("log [file]")
  .description("Show commit history with timestamps for a file or the whole repo")
  .option("-r, --repo <path>",  "path to the git repository", ".")
  .option("-n, --max-count <n>", "limit number of commits")
  .action((file: string | undefined, opts: { repo: string; maxCount?: string }) => {
    try {
      const max = opts.maxCount !== undefined ? parseInt(opts.maxCount, 10) : undefined;
      const entries = gitLog(file ?? null, opts.repo, max);
      printLog(entries);
    } catch (err) {
      console.error(String(err));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------
program
  .command("summary [path]")
  .description("Show aggregated timestamp statistics for every tracked file under path")
  .option("-r, --repo <path>", "path to the git repository", ".")
  .action((path: string | undefined, opts: { repo: string }) => {
    try {
      const summaries = summary(path ?? ".", opts.repo);
      printSummary(summaries);
    } catch (err) {
      console.error(String(err));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// github sub-commands
// ---------------------------------------------------------------------------

const github = program
  .command("github")
  .description("Extract timestamped events from the GitHub API");

/** Shared GitHub options helper */
function addGithubOptions(cmd: Command): Command {
  return cmd
    .option("-t, --token <token>", "GitHub personal access token (or set GITHUB_TOKEN)")
    .option(
      "-k, --kind <kinds>",
      "comma-separated event kinds to include: issue_comment,pr_review_comment,pr_review,commit_comment,workflow_run",
    )
    .option("--max-prs <n>",           "max PRs to inspect for reviews (default 50)")
    .option("--max-workflow-runs <n>", "max workflow runs to fetch (default 100)");
}

addGithubOptions(
  github
    .command("events <owner/repo>")
    .description("Show all timestamped events (comments, reviews, workflow runs) for a GitHub repo"),
).action(async (ownerRepo: string, opts: {
  token?: string;
  kind?: string;
  maxPrs?: string;
  maxWorkflowRuns?: string;
}) => {
  const [owner, repo] = splitOwnerRepo(ownerRepo);
  const token = opts.token ?? process.env["GITHUB_TOKEN"];
  const kinds = parseKinds(opts.kind);
  try {
    const events = await fetchAllGitHubEvents(owner, repo, {
      token,
      kinds,
      maxPRs: opts.maxPrs !== undefined ? parseInt(opts.maxPrs, 10) : undefined,
      maxWorkflowRuns: opts.maxWorkflowRuns !== undefined ? parseInt(opts.maxWorkflowRuns, 10) : undefined,
    });
    printGitHubEvents(events);
  } catch (err) {
    console.error(String(err));
    process.exit(1);
  }
});

addGithubOptions(
  github
    .command("workflows <owner/repo>")
    .description("Show GitHub Actions workflow runs (agent start/end timestamps)"),
).action(async (ownerRepo: string, opts: {
  token?: string;
  maxWorkflowRuns?: string;
}) => {
  const [owner, repo] = splitOwnerRepo(ownerRepo);
  const token = opts.token ?? process.env["GITHUB_TOKEN"];
  try {
    const events = await fetchWorkflowRuns(
      owner,
      repo,
      token,
      opts.maxWorkflowRuns !== undefined ? parseInt(opts.maxWorkflowRuns, 10) : undefined,
    );
    printWorkflowRuns(events);
  } catch (err) {
    console.error(String(err));
    process.exit(1);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitOwnerRepo(ownerRepo: string): [string, string] {
  const parts = ownerRepo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.error(`Invalid repo format "${ownerRepo}". Expected "owner/repo".`);
    process.exit(1);
  }
  return [parts[0], parts[1]];
}

function parseKinds(raw?: string): GitHubEventKind[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").map((k) => k.trim() as GitHubEventKind);
}

program.parse(process.argv);
