#!/usr/bin/env ts-node
/**
 * scripts/screenshot.ts
 *
 * Generates SVG "screenshots" of each `tv` CLI command for use in docs.
 * Run from the repository root:
 *
 *   npx ts-node scripts/screenshot.ts
 *
 * Output: docs/screenshots/<name>.svg
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ansiToSvg = require("ansi-to-svg") as (
  text: string,
  opts?: Record<string, unknown>,
) => string;

const REPO_ROOT = join(__dirname, "..");
const CLI = join(REPO_ROOT, "dist", "cli.js");
const OUT_DIR = join(REPO_ROOT, "docs", "screenshots");

/** SVG render options — dark terminal theme to match a typical iTerm/VS Code look */
const SVG_OPTS = {
  fontSize: 13,
  lineHeight: 18,
  paddingTop: 20,
  paddingLeft: 20,
  paddingBottom: 20,
  paddingRight: 20,
  colors: {
    black: "#1e1e2e",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#cba6f7",
    cyan: "#89dceb",
    white: "#cdd6f4",
    lightBlack: "#585b70",
    lightRed: "#f38ba8",
    lightGreen: "#a6e3a1",
    lightYellow: "#f9e2af",
    lightBlue: "#89b4fa",
    lightMagenta: "#cba6f7",
    lightCyan: "#89dceb",
    lightWhite: "#cdd6f4",
  },
  bg: "#1e1e2e",
  fg: "#cdd6f4",
};

interface Shot {
  /** Filename (without .svg extension) */
  name: string;
  /** Shell command to run (node <CLI> ...) */
  args: string[];
  /** Prompt label prepended as a faint line above the output */
  prompt: string;
}

const SHOTS: Shot[] = [
  {
    name: "help",
    args: ["--help"],
    prompt: "$ tv --help",
  },
  {
    name: "log",
    args: ["log", "-n", "5"],
    prompt: "$ tv log -n 5",
  },
  {
    name: "summary",
    args: ["summary"],
    prompt: "$ tv summary",
  },
  {
    name: "annotate",
    args: ["annotate", "src/git.ts"],
    prompt: "$ tv annotate src/git.ts",
  },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const shot of SHOTS) {
  const cmd = ["node", CLI, ...shot.args].join(" ");

  let raw: string;
  try {
    raw = execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    raw = (e.stdout ?? "") + (e.stderr ?? "");
  }

  // Prepend a faint "prompt" line so readers know what command produced the output
  const promptLine = `\x1b[2m${shot.prompt}\x1b[0m\n`;
  const fullText = promptLine + raw;

  const svg = ansiToSvg(fullText, SVG_OPTS);
  const outPath = join(OUT_DIR, `${shot.name}.svg`);
  writeFileSync(outPath, svg, "utf8");
  console.log(`  ✓  docs/screenshots/${shot.name}.svg`);
}

console.log("\nAll screenshots written to docs/screenshots/");
