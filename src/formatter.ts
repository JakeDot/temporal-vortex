/**
 * formatter.ts — colorized output for blame, log, and summary data.
 */

import chalk from "chalk";
import type { BlameEntry, CommitEntry, FileSummary } from "./git.js";

// ---------------------------------------------------------------------------
// Age helpers
// ---------------------------------------------------------------------------

interface AgeBand {
  maxSeconds: number;
  color: (s: string) => string;
}

const AGE_BANDS: AgeBand[] = [
  { maxSeconds: 60 * 60 * 24,       color: chalk.greenBright },    // < 1 day
  { maxSeconds: 60 * 60 * 24 * 7,   color: chalk.green },          // < 1 week
  { maxSeconds: 60 * 60 * 24 * 30,  color: chalk.yellow },         // < 1 month
  { maxSeconds: 60 * 60 * 24 * 90,  color: chalk.hex("#FFA500") },    // < 3 months
  { maxSeconds: 60 * 60 * 24 * 365, color: chalk.red },             // < 1 year
  { maxSeconds: Infinity,            color: chalk.redBright },      // ≥ 1 year
];

function ageColor(seconds: number): (s: string) => string {
  for (const band of AGE_BANDS) {
    if (seconds < band.maxSeconds) return band.color;
  }
  return chalk.redBright;
}

export function humanAge(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 86400 * 365) return `${Math.floor(seconds / (86400 * 30))}mo ago`;
  return `${(seconds / (86400 * 365)).toFixed(1)}y ago`;
}

// ---------------------------------------------------------------------------
// Blame / annotate output
// ---------------------------------------------------------------------------

/** Print per-line blame entries with color-coded age to stdout. */
export function printBlame(entries: BlameEntry[], showAuthor = true): void {
  if (entries.length === 0) {
    console.log(chalk.dim("No blame data."));
    return;
  }

  const now = Date.now();
  for (const entry of entries) {
    const ageSeconds = (now - entry.timestamp.getTime()) / 1000;
    const color = ageColor(ageSeconds);
    const ageStr = humanAge(ageSeconds).padStart(10);
    const commitShort = entry.commit.slice(0, 7);
    const lineNo = String(entry.lineNumber).padStart(4);

    const parts = [color(commitShort)];
    if (showAuthor) parts.push(chalk.dim(entry.author.slice(0, 12).padEnd(12)));
    parts.push(color(ageStr));
    parts.push(chalk.dim(lineNo));
    parts.push(entry.content);

    console.log(parts.join(" "));
  }
}

// ---------------------------------------------------------------------------
// Log output
// ---------------------------------------------------------------------------

const COL_COMMIT  = 7;
const COL_TS      = 16; // "YYYY-MM-DD HH:MM"
const COL_AGE     = 10;
const COL_AUTHOR  = 20;

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

/** Print commit history as a formatted table to stdout. */
export function printLog(entries: CommitEntry[]): void {
  if (entries.length === 0) {
    console.log(chalk.dim("No commits found."));
    return;
  }

  const header = [
    chalk.bold.magenta(pad("Commit",  COL_COMMIT)),
    chalk.bold.magenta(pad("Timestamp", COL_TS)),
    chalk.bold.magenta(pad("Age",     COL_AGE)),
    chalk.bold.magenta(pad("Author",  COL_AUTHOR)),
    chalk.bold.magenta("Message"),
  ].join("  ");
  console.log(header);
  console.log(chalk.dim("─".repeat(process.stdout.columns ?? 80)));

  const now = Date.now();
  for (const entry of entries) {
    const ageSeconds = (now - entry.timestamp.getTime()) / 1000;
    const color = ageColor(ageSeconds);
    const ageStr = humanAge(ageSeconds);
    const tsStr = entry.timestamp.toISOString().slice(0, 16).replace("T", " ");

    const row = [
      chalk.cyan(pad(entry.commit.slice(0, 7), COL_COMMIT)),
      pad(tsStr, COL_TS),
      color(pad(ageStr, COL_AGE)),
      chalk.green(pad(entry.author, COL_AUTHOR)),
      entry.message,
    ].join("  ");
    console.log(row);
  }
}

// ---------------------------------------------------------------------------
// Summary output
// ---------------------------------------------------------------------------

const SCOL_FILE    = 40;
const SCOL_LAST    = 16;
const SCOL_AGE     = 10;
const SCOL_FIRST   = 10;
const SCOL_COMMITS = 7;

/** Print file-level summary statistics sorted by newest change. */
export function printSummary(summaries: FileSummary[]): void {
  if (summaries.length === 0) {
    console.log(chalk.dim("No files found."));
    return;
  }

  const header = [
    chalk.bold.magenta(pad("File",         SCOL_FILE)),
    chalk.bold.magenta(pad("Last Changed", SCOL_LAST)),
    chalk.bold.magenta(pad("Age",          SCOL_AGE)),
    chalk.bold.magenta(pad("First Commit", SCOL_FIRST)),
    chalk.bold.magenta(pad("Commits",      SCOL_COMMITS)),
    chalk.bold.magenta("Authors"),
  ].join("  ");
  console.log(header);
  console.log(chalk.dim("─".repeat(process.stdout.columns ?? 80)));

  const now = Date.now();
  const sorted = [...summaries].sort(
    (a, b) => b.newestTimestamp.getTime() - a.newestTimestamp.getTime(),
  );

  for (const s of sorted) {
    const ageSeconds = (now - s.newestTimestamp.getTime()) / 1000;
    const color = ageColor(ageSeconds);
    const ageStr = humanAge(ageSeconds);
    const newestTs = s.newestTimestamp.toISOString().slice(0, 16).replace("T", " ");
    const oldestTs = s.oldestTimestamp.toISOString().slice(0, 10);
    const authorsStr =
      s.authors.slice(0, 3).join(", ") +
      (s.authors.length > 3 ? ` +${s.authors.length - 3}` : "");

    const row = [
      chalk.cyan(pad(s.path,               SCOL_FILE)),
      pad(newestTs,                          SCOL_LAST),
      color(pad(ageStr,                      SCOL_AGE)),
      chalk.dim(pad(oldestTs,               SCOL_FIRST)),
      pad(String(s.totalCommits),            SCOL_COMMITS),
      chalk.green(authorsStr),
    ].join("  ");
    console.log(row);
  }
}
