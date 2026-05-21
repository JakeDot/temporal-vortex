"use strict";
/**
 * formatter.ts — colorized output for blame, log, and summary data.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.humanAge = humanAge;
exports.printBlame = printBlame;
exports.printLog = printLog;
exports.printSummary = printSummary;
const chalk_1 = __importDefault(require("chalk"));
const AGE_BANDS = [
    { maxSeconds: 60 * 60 * 24, color: chalk_1.default.greenBright }, // < 1 day
    { maxSeconds: 60 * 60 * 24 * 7, color: chalk_1.default.green }, // < 1 week
    { maxSeconds: 60 * 60 * 24 * 30, color: chalk_1.default.yellow }, // < 1 month
    { maxSeconds: 60 * 60 * 24 * 90, color: chalk_1.default.keyword("orange") }, // < 3 months
    { maxSeconds: 60 * 60 * 24 * 365, color: chalk_1.default.red }, // < 1 year
    { maxSeconds: Infinity, color: chalk_1.default.redBright }, // ≥ 1 year
];
function ageColor(seconds) {
    for (const band of AGE_BANDS) {
        if (seconds < band.maxSeconds)
            return band.color;
    }
    return chalk_1.default.redBright;
}
function humanAge(seconds) {
    if (seconds < 60)
        return `${Math.floor(seconds)}s ago`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400)
        return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 86400 * 30)
        return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 86400 * 365)
        return `${Math.floor(seconds / (86400 * 30))}mo ago`;
    return `${(seconds / (86400 * 365)).toFixed(1)}y ago`;
}
// ---------------------------------------------------------------------------
// Blame / annotate output
// ---------------------------------------------------------------------------
/** Print per-line blame entries with color-coded age to stdout. */
function printBlame(entries, showAuthor = true) {
    if (entries.length === 0) {
        console.log(chalk_1.default.dim("No blame data."));
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
        if (showAuthor)
            parts.push(chalk_1.default.dim(entry.author.slice(0, 12).padEnd(12)));
        parts.push(color(ageStr));
        parts.push(chalk_1.default.dim(lineNo));
        parts.push(entry.content);
        console.log(parts.join(" "));
    }
}
// ---------------------------------------------------------------------------
// Log output
// ---------------------------------------------------------------------------
const COL_COMMIT = 7;
const COL_TS = 16; // "YYYY-MM-DD HH:MM"
const COL_AGE = 10;
const COL_AUTHOR = 20;
function pad(s, width) {
    return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}
/** Print commit history as a formatted table to stdout. */
function printLog(entries) {
    if (entries.length === 0) {
        console.log(chalk_1.default.dim("No commits found."));
        return;
    }
    const header = [
        chalk_1.default.bold.magenta(pad("Commit", COL_COMMIT)),
        chalk_1.default.bold.magenta(pad("Timestamp", COL_TS)),
        chalk_1.default.bold.magenta(pad("Age", COL_AGE)),
        chalk_1.default.bold.magenta(pad("Author", COL_AUTHOR)),
        chalk_1.default.bold.magenta("Message"),
    ].join("  ");
    console.log(header);
    console.log(chalk_1.default.dim("─".repeat(process.stdout.columns ?? 80)));
    const now = Date.now();
    for (const entry of entries) {
        const ageSeconds = (now - entry.timestamp.getTime()) / 1000;
        const color = ageColor(ageSeconds);
        const ageStr = humanAge(ageSeconds);
        const tsStr = entry.timestamp.toISOString().slice(0, 16).replace("T", " ");
        const row = [
            chalk_1.default.cyan(pad(entry.commit.slice(0, 7), COL_COMMIT)),
            pad(tsStr, COL_TS),
            color(pad(ageStr, COL_AGE)),
            chalk_1.default.green(pad(entry.author, COL_AUTHOR)),
            entry.message,
        ].join("  ");
        console.log(row);
    }
}
// ---------------------------------------------------------------------------
// Summary output
// ---------------------------------------------------------------------------
const SCOL_FILE = 40;
const SCOL_LAST = 16;
const SCOL_AGE = 10;
const SCOL_FIRST = 10;
const SCOL_COMMITS = 7;
/** Print file-level summary statistics sorted by newest change. */
function printSummary(summaries) {
    if (summaries.length === 0) {
        console.log(chalk_1.default.dim("No files found."));
        return;
    }
    const header = [
        chalk_1.default.bold.magenta(pad("File", SCOL_FILE)),
        chalk_1.default.bold.magenta(pad("Last Changed", SCOL_LAST)),
        chalk_1.default.bold.magenta(pad("Age", SCOL_AGE)),
        chalk_1.default.bold.magenta(pad("First Commit", SCOL_FIRST)),
        chalk_1.default.bold.magenta(pad("Commits", SCOL_COMMITS)),
        chalk_1.default.bold.magenta("Authors"),
    ].join("  ");
    console.log(header);
    console.log(chalk_1.default.dim("─".repeat(process.stdout.columns ?? 80)));
    const now = Date.now();
    const sorted = [...summaries].sort((a, b) => b.newestTimestamp.getTime() - a.newestTimestamp.getTime());
    for (const s of sorted) {
        const ageSeconds = (now - s.newestTimestamp.getTime()) / 1000;
        const color = ageColor(ageSeconds);
        const ageStr = humanAge(ageSeconds);
        const newestTs = s.newestTimestamp.toISOString().slice(0, 16).replace("T", " ");
        const oldestTs = s.oldestTimestamp.toISOString().slice(0, 10);
        const authorsStr = s.authors.slice(0, 3).join(", ") +
            (s.authors.length > 3 ? ` +${s.authors.length - 3}` : "");
        const row = [
            chalk_1.default.cyan(pad(s.path, SCOL_FILE)),
            pad(newestTs, SCOL_LAST),
            color(pad(ageStr, SCOL_AGE)),
            chalk_1.default.dim(pad(oldestTs, SCOL_FIRST)),
            pad(String(s.totalCommits), SCOL_COMMITS),
            chalk_1.default.green(authorsStr),
        ].join("  ");
        console.log(row);
    }
}
//# sourceMappingURL=formatter.js.map