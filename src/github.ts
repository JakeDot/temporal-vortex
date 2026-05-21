/**
 * github.ts — Extract timestamped events from the GitHub API.
 *
 * Fetches:
 *   - Issue comments (on issues and pull requests)
 *   - Pull request review comments (inline code comments)
 *   - Pull request reviews (approve/request-changes/comment)
 *   - Commit comments
 *   - Workflow runs (GitHub Actions — maps to agent start/end)
 */

import { Octokit } from "@octokit/rest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Discriminated union tag for every supported event kind. */
export type GitHubEventKind =
  | "issue_comment"
  | "pr_review_comment"
  | "pr_review"
  | "commit_comment"
  | "workflow_run";

/** A single timestamped event extracted from the GitHub API. */
export interface GitHubEvent {
  kind: GitHubEventKind;
  /** Numeric or string id as returned by the API. */
  id: string;
  /** GitHub login of the actor. */
  actor: string;
  /** UTC timestamp of the event. */
  timestamp: Date;
  /** Short human-readable description (issue title, PR title, workflow name…). */
  title: string;
  /** URL to the event on GitHub. */
  url: string;
  /** Additional context specific to the event kind. */
  metadata: GitHubEventMetadata;
}

export type GitHubEventMetadata =
  | IssueCommentMetadata
  | PRReviewCommentMetadata
  | PRReviewMetadata
  | CommitCommentMetadata
  | WorkflowRunMetadata;

export interface IssueCommentMetadata {
  kind: "issue_comment";
  issueNumber: number;
  issueTitle: string;
  isPullRequest: boolean;
  body: string;
}

export interface PRReviewCommentMetadata {
  kind: "pr_review_comment";
  pullNumber: number;
  path: string;
  line: number | null;
  body: string;
}

export interface PRReviewMetadata {
  kind: "pr_review";
  pullNumber: number;
  pullTitle: string;
  state: string;
  body: string;
}

export interface CommitCommentMetadata {
  kind: "commit_comment";
  commitSha: string;
  path: string | null;
  line: number | null;
  body: string;
}

export interface WorkflowRunMetadata {
  kind: "workflow_run";
  workflowName: string;
  runNumber: number;
  status: string;
  conclusion: string | null;
  /** ISO string of when the run started. */
  runStartedAt: string;
  /** ISO string of when the run finished (null if still running). */
  runCompletedAt: string | null;
  /** Duration in seconds, null if still running. */
  durationSeconds: number | null;
  headBranch: string | null;
  headSha: string;
  event: string;
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function makeOctokit(token?: string): Octokit {
  return new Octokit({ auth: token });
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch all issue/PR comments for *repo*.
 * GitHub's issue comment endpoint returns comments on both issues and PRs.
 */
export async function fetchIssueComments(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubEvent[]> {
  const octokit = makeOctokit(token);
  const events: GitHubEvent[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.issues.listCommentsForRepo,
    { owner, repo, per_page: 100, sort: "created", direction: "desc" },
  )) {
    for (const comment of response.data) {
      const isPR = comment.html_url.includes("/pull/");
      // Extract issue/PR number from the issue_url or pull_request_url
      const issueUrl = comment.issue_url ?? "";
      const issueNumber = parseInt(issueUrl.split("/").pop() ?? "0", 10);
      events.push({
        kind: "issue_comment",
        id: String(comment.id),
        actor: comment.user?.login ?? "unknown",
        timestamp: new Date(comment.created_at),
        title: `Comment on ${isPR ? "PR" : "issue"} #${issueNumber}`,
        url: comment.html_url,
        metadata: {
          kind: "issue_comment",
          issueNumber,
          issueTitle: "",
          isPullRequest: isPR,
          body: comment.body ?? "",
        },
      });
    }
  }

  return events;
}

/**
 * Fetch all PR review (inline code) comments for *repo*.
 */
export async function fetchPRReviewComments(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubEvent[]> {
  const octokit = makeOctokit(token);
  const events: GitHubEvent[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.pulls.listReviewCommentsForRepo,
    { owner, repo, per_page: 100, sort: "created", direction: "desc" },
  )) {
    for (const comment of response.data) {
      const pullNumber = parseInt(
        comment.pull_request_url.split("/").pop() ?? "0",
        10,
      );
      events.push({
        kind: "pr_review_comment",
        id: String(comment.id),
        actor: comment.user?.login ?? "unknown",
        timestamp: new Date(comment.created_at),
        title: `Review comment on PR #${pullNumber} — ${comment.path}`,
        url: comment.html_url,
        metadata: {
          kind: "pr_review_comment",
          pullNumber,
          path: comment.path,
          line: comment.line ?? null,
          body: comment.body,
        },
      });
    }
  }

  return events;
}

/**
 * Fetch all PR reviews (approve / request-changes / comment) for *repo*.
 * Iterates open + closed PRs up to *maxPRs*.
 */
export async function fetchPRReviews(
  owner: string,
  repo: string,
  token?: string,
  maxPRs = 50,
): Promise<GitHubEvent[]> {
  const octokit = makeOctokit(token);
  const events: GitHubEvent[] = [];

  const prs = await octokit.paginate(octokit.rest.pulls.list, {
    owner,
    repo,
    state: "all",
    per_page: Math.min(maxPRs, 100),
  });

  for (const pr of prs.slice(0, maxPRs)) {
    const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: pr.number,
      per_page: 100,
    });
    for (const review of reviews) {
      if (!review.submitted_at) continue;
      events.push({
        kind: "pr_review",
        id: String(review.id),
        actor: review.user?.login ?? "unknown",
        timestamp: new Date(review.submitted_at),
        title: `${review.state} review on PR #${pr.number}: ${pr.title}`,
        url: review.html_url,
        metadata: {
          kind: "pr_review",
          pullNumber: pr.number,
          pullTitle: pr.title,
          state: review.state,
          body: review.body ?? "",
        },
      });
    }
  }

  return events;
}

/**
 * Fetch all commit comments for *repo*.
 */
export async function fetchCommitComments(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubEvent[]> {
  const octokit = makeOctokit(token);
  const events: GitHubEvent[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.repos.listCommitCommentsForRepo,
    { owner, repo, per_page: 100 },
  )) {
    for (const comment of response.data) {
      const sha = comment.commit_id ?? "";
      events.push({
        kind: "commit_comment",
        id: String(comment.id),
        actor: comment.user?.login ?? "unknown",
        timestamp: new Date(comment.created_at),
        title: `Commit comment on ${sha.slice(0, 7)}`,
        url: comment.html_url,
        metadata: {
          kind: "commit_comment",
          commitSha: sha,
          path: comment.path ?? null,
          line: comment.line ?? null,
          body: comment.body,
        },
      });
    }
  }

  return events;
}

/**
 * Fetch GitHub Actions workflow runs for *repo*.
 * Each run captures: creation time (agent start) and updated time (agent end).
 */
export async function fetchWorkflowRuns(
  owner: string,
  repo: string,
  token?: string,
  maxRuns = 100,
): Promise<GitHubEvent[]> {
  const octokit = makeOctokit(token);
  const events: GitHubEvent[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.actions.listWorkflowRunsForRepo,
    { owner, repo, per_page: 100 },
  )) {
    for (const run of response.data) {
      const startedAt = run.run_started_at ?? run.created_at;
      const completedAt = run.updated_at ?? null;
      const durationSeconds =
        completedAt && run.status === "completed"
          ? (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
          : null;

      events.push({
        kind: "workflow_run",
        id: String(run.id),
        actor: run.actor?.login ?? "unknown",
        // Use created_at as the primary timestamp (run was triggered at this point)
        timestamp: new Date(run.created_at),
        title: `${run.name ?? run.workflow_id} #${run.run_number} (${run.event})`,
        url: run.html_url,
        metadata: {
          kind: "workflow_run",
          workflowName: run.name ?? String(run.workflow_id),
          runNumber: run.run_number,
          status: run.status ?? "unknown",
          conclusion: run.conclusion ?? null,
          runStartedAt: startedAt,
          runCompletedAt:
            run.status === "completed" ? completedAt : null,
          durationSeconds,
          headBranch: run.head_branch ?? null,
          headSha: run.head_sha,
          event: run.event,
        },
      });

      if (events.length >= maxRuns) break;
    }
    if (events.length >= maxRuns) break;
  }

  return events;
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export interface FetchAllOptions {
  token?: string;
  kinds?: GitHubEventKind[];
  maxPRs?: number;
  maxWorkflowRuns?: number;
}

/**
 * Fetch all supported GitHub event kinds for *owner/repo*, merge them, and
 * sort by timestamp (newest first).
 */
export async function fetchAllGitHubEvents(
  owner: string,
  repo: string,
  options: FetchAllOptions = {},
): Promise<GitHubEvent[]> {
  const {
    token,
    kinds = ["issue_comment", "pr_review_comment", "pr_review", "commit_comment", "workflow_run"],
    maxPRs = 50,
    maxWorkflowRuns = 100,
  } = options;

  const fetchers: Array<Promise<GitHubEvent[]>> = [];

  if (kinds.includes("issue_comment"))
    fetchers.push(fetchIssueComments(owner, repo, token).catch(() => []));
  if (kinds.includes("pr_review_comment"))
    fetchers.push(fetchPRReviewComments(owner, repo, token).catch(() => []));
  if (kinds.includes("pr_review"))
    fetchers.push(fetchPRReviews(owner, repo, token, maxPRs).catch(() => []));
  if (kinds.includes("commit_comment"))
    fetchers.push(fetchCommitComments(owner, repo, token).catch(() => []));
  if (kinds.includes("workflow_run"))
    fetchers.push(fetchWorkflowRuns(owner, repo, token, maxWorkflowRuns).catch(() => []));

  const results = await Promise.all(fetchers);
  const all = results.flat();
  all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return all;
}
