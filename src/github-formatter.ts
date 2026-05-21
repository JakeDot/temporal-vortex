/**
 * github-formatter.ts — colorized output for GitHub metadata events.
 */

import chalk from "chalk";
import type {
  GitHubEvent,
  GitHubEventKind,
  WorkflowRunMetadata,
} from "./github.js";
import { humanAge } from "./formatter.js";

// ---------------------------------------------------------------------------
// Kind labels & colors
// ---------------------------------------------------------------------------

const KIND_LABELS: Record<GitHubEventKind, string> = {
  issue_comment:    "issue-comment   ",
  pr_review_comment:"pr-review-cmt   ",
  pr_review:        "pr-review       ",
  commit_comment:   "commit-comment  ",
  workflow_run:     "workflow-run    ",
};

const KIND_COLORS: Record<GitHubEventKind, (s: string) => string> = {
  issue_comment:     chalk.blue,
  pr_review_comment: chalk.magenta,
  pr_review:         chalk.cyan,
  commit_comment:    chalk.yellow,
  workflow_run:      chalk.white,
};

// ---------------------------------------------------------------------------
// Workflow conclusion colors
// ---------------------------------------------------------------------------

function conclusionColor(conclusion: string | null): (s: string) => string {
  switch (conclusion) {
    case "success":   return chalk.green;
    case "failure":   return chalk.red;
    case "cancelled": return chalk.yellow;
    case "skipped":   return chalk.dim;
    default:          return chalk.white;
  }
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const COL_KIND   = 18;
const COL_TS     = 16;
const COL_AGE    = 10;
const COL_ACTOR  = 18;

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

// ---------------------------------------------------------------------------
// Main print function
// ---------------------------------------------------------------------------

/** Print GitHub events as a formatted table to stdout. */
export function printGitHubEvents(events: GitHubEvent[]): void {
  if (events.length === 0) {
    console.log(chalk.dim("No GitHub events found."));
    return;
  }

  const header = [
    chalk.bold.magenta(pad("Kind",         COL_KIND)),
    chalk.bold.magenta(pad("Timestamp",    COL_TS)),
    chalk.bold.magenta(pad("Age",          COL_AGE)),
    chalk.bold.magenta(pad("Actor",        COL_ACTOR)),
    chalk.bold.magenta("Details"),
  ].join("  ");
  console.log(header);
  console.log(chalk.dim("─".repeat(process.stdout.columns ?? 80)));

  const now = Date.now();

  for (const event of events) {
    const ageSeconds = (now - event.timestamp.getTime()) / 1000;
    const ageStr = humanAge(ageSeconds);
    const tsStr = event.timestamp.toISOString().slice(0, 16).replace("T", " ");
    const kindLabel = KIND_LABELS[event.kind];
    const kindColor = KIND_COLORS[event.kind];
    const details = buildDetails(event);

    const row = [
      kindColor(pad(kindLabel, COL_KIND)),
      pad(tsStr,               COL_TS),
      chalk.dim(pad(ageStr,    COL_AGE)),
      chalk.green(pad(event.actor, COL_ACTOR)),
      details,
    ].join("  ");
    console.log(row);
  }
}

function buildDetails(event: GitHubEvent): string {
  if (event.kind === "workflow_run") {
    const m = event.metadata as WorkflowRunMetadata;
    const conclusionStr = m.conclusion
      ? conclusionColor(m.conclusion)(`[${m.conclusion}]`)
      : chalk.dim(`[${m.status}]`);
    const durationStr = m.durationSeconds !== null
      ? chalk.dim(` ${humanAge(m.durationSeconds).replace(" ago", "")}`)
      : "";
    return `${event.title} ${conclusionStr}${durationStr}`;
  }
  return event.title;
}

// ---------------------------------------------------------------------------
// Workflow-run-specific summary (agent start/end view)
// ---------------------------------------------------------------------------

interface WorkflowSummaryRow {
  name: string;
  runNumber: number;
  event: string;
  startedAt: Date;
  completedAt: Date | null;
  durationSeconds: number | null;
  conclusion: string | null;
  actor: string;
  branch: string | null;
}

const WCOL_NAME     = 30;
const WCOL_RUN      = 6;
const WCOL_EVENT    = 14;
const WCOL_STARTED  = 16;
const WCOL_DURATION = 12;
const WCOL_RESULT   = 12;
const WCOL_ACTOR    = 16;

/** Print workflow runs in a dedicated agent-start/end table. */
export function printWorkflowRuns(events: GitHubEvent[]): void {
  const runs: WorkflowSummaryRow[] = events
    .filter((e) => e.kind === "workflow_run")
    .map((e) => {
      const m = e.metadata as WorkflowRunMetadata;
      return {
        name: m.workflowName,
        runNumber: m.runNumber,
        event: m.event,
        startedAt: new Date(m.runStartedAt),
        completedAt: m.runCompletedAt ? new Date(m.runCompletedAt) : null,
        durationSeconds: m.durationSeconds,
        conclusion: m.conclusion,
        actor: e.actor,
        branch: m.headBranch,
      };
    });

  if (runs.length === 0) {
    console.log(chalk.dim("No workflow runs found."));
    return;
  }

  const header = [
    chalk.bold.magenta(pad("Workflow",  WCOL_NAME)),
    chalk.bold.magenta(pad("#",         WCOL_RUN)),
    chalk.bold.magenta(pad("Trigger",   WCOL_EVENT)),
    chalk.bold.magenta(pad("Started",   WCOL_STARTED)),
    chalk.bold.magenta(pad("Duration",  WCOL_DURATION)),
    chalk.bold.magenta(pad("Result",    WCOL_RESULT)),
    chalk.bold.magenta(pad("Actor",     WCOL_ACTOR)),
    chalk.bold.magenta("Branch"),
  ].join("  ");
  console.log(header);
  console.log(chalk.dim("─".repeat(process.stdout.columns ?? 80)));

  for (const run of runs) {
    const startedStr = run.startedAt.toISOString().slice(0, 16).replace("T", " ");
    const durationStr = run.durationSeconds !== null
      ? formatDuration(run.durationSeconds)
      : chalk.dim("running…");
    const color = conclusionColor(run.conclusion);
    const conclusionStr = color(pad(run.conclusion ?? (run.completedAt ? "—" : "running"), WCOL_RESULT));

    const row = [
      chalk.cyan(pad(run.name,              WCOL_NAME)),
      pad(String(run.runNumber),             WCOL_RUN),
      chalk.dim(pad(run.event,              WCOL_EVENT)),
      pad(startedStr,                        WCOL_STARTED),
      pad(durationStr,                       WCOL_DURATION),
      conclusionStr,
      chalk.green(pad(run.actor,            WCOL_ACTOR)),
      chalk.dim(run.branch ?? ""),
    ].join("  ");
    console.log(row);
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
