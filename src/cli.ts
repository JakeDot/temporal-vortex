#!/usr/bin/env node
/**
 * cli.ts — temporal-vortex command-line interface.
 *
 * Commands:
 *   tv annotate <file>          Per-line timestamps (git blame)
 *   tv log <file>               Commit history for a file
 *   tv log                      Commit history for the whole repo
 *   tv summary [path]           File-level timestamp statistics
 */

import { Command } from "commander";
import { blame, gitLog, summary } from "./git.js";
import { printBlame, printLog, printSummary } from "./formatter.js";

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

program.parse(process.argv);
