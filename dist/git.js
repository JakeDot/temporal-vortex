"use strict";
/**
 * git.ts — git blame and log timestamp extraction.
 *
 * All functions spawn git as a child process and parse its output.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePorcelainBlame = parsePorcelainBlame;
exports.blame = blame;
exports.parseLogOutput = parseLogOutput;
exports.gitLog = gitLog;
exports.summary = summary;
const child_process_1 = require("child_process");
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function run(args, cwd) {
    try {
        return (0, child_process_1.execSync)(args.join(" "), { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`git error: ${msg}`);
    }
}
function fromUnixTimestamp(unixSeconds, tzOffset = "+0000") {
    const sign = tzOffset[0] === "-" ? -1 : 1;
    const hours = parseInt(tzOffset.slice(1, 3), 10);
    const minutes = parseInt(tzOffset.slice(3, 5), 10);
    const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;
    // Date.UTC already gives us a UTC epoch; subtract offset to convert local → UTC
    return new Date(unixSeconds * 1000 - offsetMs);
}
// ---------------------------------------------------------------------------
// Blame
// ---------------------------------------------------------------------------
const HASH_LINE = /^([0-9a-f]{40}) \d+ (\d+)/;
/**
 * Parse raw `git blame --porcelain` output into {@link BlameEntry} objects.
 * Exported for unit testing.
 */
function parsePorcelainBlame(output) {
    const lines = output.split("\n");
    const meta = {};
    const entries = [];
    let currentHash = "";
    let currentLine = 0;
    for (const line of lines) {
        const m = line.match(HASH_LINE);
        if (m) {
            currentHash = m[1];
            currentLine = parseInt(m[2], 10);
            if (!meta[currentHash])
                meta[currentHash] = {};
            continue;
        }
        if (line.startsWith("\t")) {
            const content = line.slice(1);
            const info = meta[currentHash] ?? {};
            const ts = fromUnixTimestamp(parseInt(info["author-time"] ?? "0", 10), info["author-tz"] ?? "+0000");
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
function blame(filePath, repoPath = ".") {
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
function parseLogOutput(output) {
    return output
        .split("\n")
        .filter((l) => l.trim())
        .map((line) => {
        const parts = line.split(LOG_SEP);
        if (parts.length < 5)
            return null;
        const [commit, author, authorEmail, tsStr, ...msgParts] = parts;
        return {
            commit,
            author,
            authorEmail,
            timestamp: fromUnixTimestamp(parseInt(tsStr, 10)),
            message: msgParts.join(LOG_SEP),
        };
    })
        .filter((e) => e !== null);
}
/**
 * Return commit history for *filePath* (or the whole repo if omitted).
 * Results are ordered newest-first.
 */
function gitLog(filePath, repoPath = ".", maxCount) {
    const fmt = ["%H", "%an", "%ae", "%at", "%s"].join(LOG_SEP);
    const args = ["git", "log", `--format=${fmt}`];
    if (maxCount !== undefined)
        args.push(`-${maxCount}`);
    if (filePath)
        args.push("--", filePath);
    const output = run(args, repoPath);
    return parseLogOutput(output);
}
// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
/** Return aggregated timestamp stats for every tracked file under *path*. */
function summary(path = ".", repoPath = ".") {
    const lsOutput = run(["git", "ls-files", "--", path], repoPath);
    const files = lsOutput.split("\n").filter((f) => f.trim());
    return files.flatMap((file) => {
        const entries = gitLog(file, repoPath);
        if (entries.length === 0)
            return [];
        const newest = entries[0];
        const oldest = entries[entries.length - 1];
        const seenAuthors = new Set();
        const authors = [];
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
            },
        ];
    });
}
//# sourceMappingURL=git.js.map