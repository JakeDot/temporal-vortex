/**
 * formatter.ts — colorized output for blame, log, and summary data.
 */
import type { BlameEntry, CommitEntry, FileSummary } from "./git.js";
export declare function humanAge(seconds: number): string;
/** Print per-line blame entries with color-coded age to stdout. */
export declare function printBlame(entries: BlameEntry[], showAuthor?: boolean): void;
/** Print commit history as a formatted table to stdout. */
export declare function printLog(entries: CommitEntry[]): void;
/** Print file-level summary statistics sorted by newest change. */
export declare function printSummary(summaries: FileSummary[]): void;
//# sourceMappingURL=formatter.d.ts.map