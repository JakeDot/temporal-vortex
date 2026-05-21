#!/usr/bin/env node
"use strict";
/**
 * cli.ts — temporal-vortex command-line interface.
 *
 * Commands:
 *   tv annotate <file>          Per-line timestamps (git blame)
 *   tv log <file>               Commit history for a file
 *   tv log                      Commit history for the whole repo
 *   tv summary [path]           File-level timestamp statistics
 */
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const git_js_1 = require("./git.js");
const formatter_js_1 = require("./formatter.js");
const program = new commander_1.Command();
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
    .option("--no-author", "omit author column")
    .action((file, opts) => {
    try {
        const entries = (0, git_js_1.blame)(file, opts.repo);
        (0, formatter_js_1.printBlame)(entries, opts.author);
    }
    catch (err) {
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
    .option("-r, --repo <path>", "path to the git repository", ".")
    .option("-n, --max-count <n>", "limit number of commits")
    .action((file, opts) => {
    try {
        const max = opts.maxCount !== undefined ? parseInt(opts.maxCount, 10) : undefined;
        const entries = (0, git_js_1.gitLog)(file ?? null, opts.repo, max);
        (0, formatter_js_1.printLog)(entries);
    }
    catch (err) {
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
    .action((path, opts) => {
    try {
        const summaries = (0, git_js_1.summary)(path ?? ".", opts.repo);
        (0, formatter_js_1.printSummary)(summaries);
    }
    catch (err) {
        console.error(String(err));
        process.exit(1);
    }
});
program.parse(process.argv);
//# sourceMappingURL=cli.js.map