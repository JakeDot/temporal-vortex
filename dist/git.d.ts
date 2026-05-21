/**
 * git.ts — git blame and log timestamp extraction.
 *
 * All functions spawn git as a child process and parse its output.
 */
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
/**
 * Parse raw `git blame --porcelain` output into {@link BlameEntry} objects.
 * Exported for unit testing.
 */
export declare function parsePorcelainBlame(output: string): BlameEntry[];
/** Run `git blame --porcelain` on *filePath* inside *repoPath*. */
export declare function blame(filePath: string, repoPath?: string): BlameEntry[];
/**
 * Parse raw `git log` output (formatted with LOG_SEP delimiters) into
 * {@link CommitEntry} objects.  Exported for unit testing.
 */
export declare function parseLogOutput(output: string): CommitEntry[];
/**
 * Return commit history for *filePath* (or the whole repo if omitted).
 * Results are ordered newest-first.
 */
export declare function gitLog(filePath: string | null, repoPath?: string, maxCount?: number): CommitEntry[];
/** Return aggregated timestamp stats for every tracked file under *path*. */
export declare function summary(path?: string, repoPath?: string): FileSummary[];
//# sourceMappingURL=git.d.ts.map