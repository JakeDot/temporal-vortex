/**
 * git.ts — git blame and log timestamp extraction.
 *
 * All functions spawn git as a child process and parse its output.
 */

import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-line blame information with timestamp. */
export interface BlameEntry {
  /** Full 40-char commit hash. */
  commit: string;
  author: string;
  authorEmail: string;
  /** UTC timestamp of the commit that last touched this line. */
  timestamp: Date;
  lineNumber: number;
  content: string;
}

/** A single commit record from `git log`. */
export interface CommitEntry {
  commit: string;
  author: string;
  authorEmail: string;
  timestamp: Date;
  message: string;
}

/** Aggregated timestamp statistics for a single tracked file. */
export interface FileSummary {
  path: string;
  newestCommit: string;
  newestTimestamp: Date;
  oldestCommit: string;
  oldestTimestamp: Date;
  totalCommits: number;
  authors: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function run(args: string[], cwd: string): string {
  try {
    return execSync(args.join(" "), { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`git error: ${msg}`);
  }
}

function fromUnixTimestamp(unixSeconds: number): Date {
  // Git's author-time / committer-time fields are always UTC Unix timestamps.
  // The tz offset (author-tz) is only for display and must not change the epoch.
  return new Date(unixSeconds * 1000);
}

// ---------------------------------------------------------------------------
// Blame
// ---------------------------------------------------------------------------

const HASH_LINE = /^([0-9a-f]{40}) \d+ (\d+)/;

/**
 * Parse raw `git blame --porcelain` output into {@link BlameEntry} objects.
 * Exported for unit testing.
 */
export function parsePorcelainBlame(output: string): BlameEntry[] {
  const lines = output.split("\n");
  const meta: Record<string, Record<string, string>> = {};
  const entries: BlameEntry[] = [];

  let currentHash = "";
  let currentLine = 0;

  for (const line of lines) {
    const m = line.match(HASH_LINE);
    if (m) {
      currentHash = m[1];
      currentLine = parseInt(m[2], 10);
      if (!meta[currentHash]) meta[currentHash] = {};
      continue;
    }

    if (line.startsWith("\t")) {
      const content = line.slice(1);
      const info = meta[currentHash] ?? {};
      const ts = fromUnixTimestamp(
        parseInt(info["author-time"] ?? "0", 10),
      );
      entries.push({
        commit: currentHash,
        author: info["author"] ?? "unknown",
        authorEmail: info["author-mail"] ?? "",
        timestamp: ts,
        lineNumber: currentLine,
        content,
      });
      continue;
    }

    // Metadata: "key value"
    const spaceIdx = line.indexOf(" ");
    if (spaceIdx !== -1 && currentHash) {
      const key = line.slice(0, spaceIdx);
      const value = line.slice(spaceIdx + 1);
      meta[currentHash][key] = value;
    }
  }

  return entries;
}

/** Run `git blame --porcelain` on *filePath* inside *repoPath*. */
export function blame(filePath: string, repoPath = "."): BlameEntry[] {
  const output = run(["git", "blame", "--porcelain", "--", filePath], repoPath);
  return parsePorcelainBlame(output);
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

const LOG_SEP = "\x1f"; // ASCII Unit Separator — safe delimiter

/**
 * Parse raw `git log` output (formatted with LOG_SEP delimiters) into
 * {@link CommitEntry} objects.  Exported for unit testing.
 */
export function parseLogOutput(output: string): CommitEntry[] {
  return output
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.split(LOG_SEP);
      if (parts.length < 5) return null;
      const [commit, author, authorEmail, tsStr, ...msgParts] = parts;
      return {
        commit,
        author,
        authorEmail,
        timestamp: fromUnixTimestamp(parseInt(tsStr, 10)),
        message: msgParts.join(LOG_SEP),
      } satisfies CommitEntry;
    })
    .filter((e): e is CommitEntry => e !== null);
}

/**
 * Return commit history for *filePath* (or the whole repo if omitted).
 * Results are ordered newest-first.
 */
export function gitLog(
  filePath: string | null,
  repoPath = ".",
  maxCount?: number,
): CommitEntry[] {
  const fmt = ["%H", "%an", "%ae", "%at", "%s"].join(LOG_SEP);
  const args = ["git", "log", `--format=${fmt}`];
  if (maxCount !== undefined) args.push(`-${maxCount}`);
  if (filePath) args.push("--", filePath);
  const output = run(args, repoPath);
  return parseLogOutput(output);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/** Return aggregated timestamp stats for every tracked file under *path*. */
export function summary(path = ".", repoPath = "."): FileSummary[] {
  const lsOutput = run(["git", "ls-files", "--", path], repoPath);
  const files = lsOutput.split("\n").filter((f) => f.trim());

  return files.flatMap((file) => {
    const entries = gitLog(file, repoPath);
    if (entries.length === 0) return [];

    const newest = entries[0];
    const oldest = entries[entries.length - 1];
    const seenAuthors = new Set<string>();
    const authors: string[] = [];
    for (const e of entries) {
      if (!seenAuthors.has(e.author)) {
        seenAuthors.add(e.author);
        authors.push(e.author);
      }
    }

    return [
      {
        path: file,
        newestCommit: newest.commit.slice(0, 7),
        newestTimestamp: newest.timestamp,
        oldestCommit: oldest.commit.slice(0, 7),
        oldestTimestamp: oldest.timestamp,
        totalCommits: entries.length,
        authors,
      } satisfies FileSummary,
    ];
  });
}
