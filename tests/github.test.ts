/**
 * Tests for github.ts data types and the fetchAllGitHubEvents aggregator.
 * We mock the Octokit client to avoid real network calls.
 */

import {
  fetchAllGitHubEvents,
  fetchIssueComments,
  fetchPRReviewComments,
  fetchCommitComments,
  fetchWorkflowRuns,
  type GitHubEvent,
  type GitHubEventKind,
} from "../src/github";

// ---------------------------------------------------------------------------
// Mock @octokit/rest
// ---------------------------------------------------------------------------

const mockPaginate = jest.fn();
const mockPaginateIterator = jest.fn();

jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    paginate: Object.assign(mockPaginate, {
      iterator: mockPaginateIterator,
    }),
    rest: {
      issues: {
        listCommentsForRepo: "issues.listCommentsForRepo",
      },
      pulls: {
        list: "pulls.list",
        listReviews: "pulls.listReviews",
        listReviewCommentsForRepo: "pulls.listReviewCommentsForRepo",
      },
      repos: {
        listCommitCommentsForRepo: "repos.listCommitCommentsForRepo",
      },
      actions: {
        listWorkflowRunsForRepo: "actions.listWorkflowRunsForRepo",
      },
    },
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAsyncIterator<T>(pages: T[]): AsyncIterableIterator<T> {
  let i = 0;
  const iter = {
    next: async () =>
      i < pages.length
        ? { value: pages[i++], done: false as const }
        : { value: undefined as unknown as T, done: true as const },
    [Symbol.asyncIterator]() {
      return iter;
    },
  };
  return iter;
}

// ---------------------------------------------------------------------------
// fetchIssueComments
// ---------------------------------------------------------------------------

describe("fetchIssueComments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps API data to GitHubEvent objects", async () => {
    mockPaginateIterator.mockReturnValue(
      makeAsyncIterator([
        {
          data: [
            {
              id: 1,
              user: { login: "alice" },
              created_at: "2024-01-15T10:00:00Z",
              html_url: "https://github.com/owner/repo/issues/5#issuecomment-1",
              issue_url: "https://api.github.com/repos/owner/repo/issues/5",
              body: "Hello world",
            },
          ],
        },
      ]),
    );

    const events = await fetchIssueComments("owner", "repo");
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.kind).toBe("issue_comment");
    expect(e.actor).toBe("alice");
    expect(e.timestamp).toEqual(new Date("2024-01-15T10:00:00Z"));
    expect(e.id).toBe("1");
  });

  it("correctly detects PR vs issue from html_url", async () => {
    mockPaginateIterator.mockReturnValue(
      makeAsyncIterator([
        {
          data: [
            {
              id: 2,
              user: { login: "bob" },
              created_at: "2024-02-01T00:00:00Z",
              html_url: "https://github.com/owner/repo/pull/3#issuecomment-2",
              issue_url: "https://api.github.com/repos/owner/repo/issues/3",
              body: "LGTM",
            },
          ],
        },
      ]),
    );

    const events = await fetchIssueComments("owner", "repo");
    const meta = events[0].metadata;
    expect(meta.kind).toBe("issue_comment");
    if (meta.kind === "issue_comment") {
      expect(meta.isPullRequest).toBe(true);
    }
  });

  it("returns empty array when no comments", async () => {
    mockPaginateIterator.mockReturnValue(makeAsyncIterator([{ data: [] }]));
    const events = await fetchIssueComments("owner", "repo");
    expect(events).toHaveLength(0);
  });

  it("falls back to 'unknown' when user is null", async () => {
    mockPaginateIterator.mockReturnValue(
      makeAsyncIterator([
        {
          data: [
            {
              id: 9,
              user: null,
              created_at: "2024-03-01T00:00:00Z",
              html_url: "https://github.com/o/r/issues/1#c-9",
              issue_url: "https://api.github.com/repos/o/r/issues/1",
              body: "ghost comment",
            },
          ],
        },
      ]),
    );
    const events = await fetchIssueComments("owner", "repo");
    expect(events[0].actor).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// fetchPRReviewComments
// ---------------------------------------------------------------------------

describe("fetchPRReviewComments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps API data to GitHubEvent objects", async () => {
    mockPaginateIterator.mockReturnValue(
      makeAsyncIterator([
        {
          data: [
            {
              id: 10,
              user: { login: "charlie" },
              created_at: "2024-03-10T12:00:00Z",
              html_url: "https://github.com/owner/repo/pull/7#discussion_r10",
              pull_request_url: "https://api.github.com/repos/owner/repo/pulls/7",
              path: "src/index.ts",
              line: 42,
              body: "Consider refactoring",
            },
          ],
        },
      ]),
    );

    const events = await fetchPRReviewComments("owner", "repo");
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.kind).toBe("pr_review_comment");
    expect(e.actor).toBe("charlie");
    const meta = e.metadata;
    if (meta.kind === "pr_review_comment") {
      expect(meta.path).toBe("src/index.ts");
      expect(meta.line).toBe(42);
      expect(meta.pullNumber).toBe(7);
    }
  });
});

// ---------------------------------------------------------------------------
// fetchCommitComments
// ---------------------------------------------------------------------------

describe("fetchCommitComments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps API data to GitHubEvent objects", async () => {
    mockPaginateIterator.mockReturnValue(
      makeAsyncIterator([
        {
          data: [
            {
              id: 20,
              user: { login: "dave" },
              created_at: "2024-04-05T08:00:00Z",
              html_url: "https://github.com/owner/repo/commit/abc123#r20",
              commit_id: "abc123def456abc123def456abc123def456abc1",
              path: "README.md",
              line: 5,
              body: "typo here",
            },
          ],
        },
      ]),
    );

    const events = await fetchCommitComments("owner", "repo");
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.kind).toBe("commit_comment");
    expect(e.actor).toBe("dave");
    const meta = e.metadata;
    if (meta.kind === "commit_comment") {
      expect(meta.commitSha).toBe("abc123def456abc123def456abc123def456abc1");
      expect(meta.path).toBe("README.md");
      expect(meta.line).toBe(5);
    }
  });
});

// ---------------------------------------------------------------------------
// fetchWorkflowRuns
// ---------------------------------------------------------------------------

describe("fetchWorkflowRuns", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps API data to GitHubEvent objects", async () => {
    mockPaginateIterator.mockReturnValue(
      makeAsyncIterator([
        {
          data: [
            {
              id: 100,
              name: "CI",
              workflow_id: 42,
              run_number: 7,
              status: "completed",
              conclusion: "success",
              created_at: "2024-05-01T09:00:00Z",
              run_started_at: "2024-05-01T09:01:00Z",
              updated_at: "2024-05-01T09:05:00Z",
              html_url: "https://github.com/owner/repo/actions/runs/100",
              actor: { login: "eve" },
              head_branch: "main",
              head_sha: "deadbeefdeadbeef",
              event: "push",
            },
          ],
        },
      ]),
    );

    const events = await fetchWorkflowRuns("owner", "repo");
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.kind).toBe("workflow_run");
    expect(e.actor).toBe("eve");
    expect(e.timestamp).toEqual(new Date("2024-05-01T09:00:00Z"));
    const meta = e.metadata;
    if (meta.kind === "workflow_run") {
      expect(meta.workflowName).toBe("CI");
      expect(meta.runNumber).toBe(7);
      expect(meta.conclusion).toBe("success");
      expect(meta.status).toBe("completed");
      expect(meta.headBranch).toBe("main");
      expect(meta.event).toBe("push");
      // duration: 09:05 - 09:01 = 240s
      expect(meta.durationSeconds).toBe(240);
    }
  });

  it("sets durationSeconds null when run is still in progress", async () => {
    mockPaginateIterator.mockReturnValue(
      makeAsyncIterator([
        {
          data: [
            {
              id: 200,
              name: "Deploy",
              workflow_id: 99,
              run_number: 1,
              status: "in_progress",
              conclusion: null,
              created_at: "2024-05-02T10:00:00Z",
              run_started_at: "2024-05-02T10:00:00Z",
              updated_at: "2024-05-02T10:02:00Z",
              html_url: "https://github.com/owner/repo/actions/runs/200",
              actor: { login: "frank" },
              head_branch: "feature/x",
              head_sha: "cafebabecafebabe",
              event: "workflow_dispatch",
            },
          ],
        },
      ]),
    );

    const events = await fetchWorkflowRuns("owner", "repo");
    const meta = events[0].metadata;
    if (meta.kind === "workflow_run") {
      expect(meta.durationSeconds).toBeNull();
      expect(meta.runCompletedAt).toBeNull();
    }
  });

  it("respects maxRuns limit", async () => {
    const runs = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      name: "CI",
      workflow_id: 1,
      run_number: i + 1,
      status: "completed",
      conclusion: "success",
      created_at: "2024-01-01T00:00:00Z",
      run_started_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:01:00Z",
      html_url: `https://github.com/o/r/actions/runs/${i}`,
      actor: { login: "user" },
      head_branch: "main",
      head_sha: "abc",
      event: "push",
    }));
    mockPaginateIterator.mockReturnValue(makeAsyncIterator([{ data: runs }]));

    const events = await fetchWorkflowRuns("owner", "repo", undefined, 3);
    expect(events.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// fetchAllGitHubEvents
// ---------------------------------------------------------------------------

describe("fetchAllGitHubEvents", () => {
  beforeEach(() => jest.clearAllMocks());

  it("merges and sorts events by timestamp descending", async () => {
    // Issue comment — older
    // Workflow run — newer
    mockPaginateIterator.mockImplementation((endpoint: string) => {
      if (endpoint === "issues.listCommentsForRepo") {
        return makeAsyncIterator([
          {
            data: [
              {
                id: 1,
                user: { login: "alice" },
                created_at: "2024-01-01T00:00:00Z",
                html_url: "https://github.com/o/r/issues/1#c-1",
                issue_url: "https://api.github.com/repos/o/r/issues/1",
                body: "old comment",
              },
            ],
          },
        ]);
      }
      if (endpoint === "actions.listWorkflowRunsForRepo") {
        return makeAsyncIterator([
          {
            data: [
              {
                id: 99,
                name: "CI",
                workflow_id: 1,
                run_number: 1,
                status: "completed",
                conclusion: "success",
                created_at: "2024-06-01T00:00:00Z",
                run_started_at: "2024-06-01T00:00:00Z",
                updated_at: "2024-06-01T00:01:00Z",
                html_url: "https://github.com/o/r/actions/runs/99",
                actor: { login: "ci-bot" },
                head_branch: "main",
                head_sha: "abc",
                event: "push",
              },
            ],
          },
        ]);
      }
      return makeAsyncIterator([{ data: [] }]);
    });

    // pr_review uses paginate() directly, not iterator
    mockPaginate.mockResolvedValue([]);

    const events = await fetchAllGitHubEvents("owner", "repo", {
      kinds: ["issue_comment", "workflow_run"],
    });

    expect(events.length).toBe(2);
    // newest first
    expect(events[0].kind).toBe("workflow_run");
    expect(events[1].kind).toBe("issue_comment");
    expect(events[0].timestamp.getTime()).toBeGreaterThan(events[1].timestamp.getTime());
  });

  it("filters by requested kinds", async () => {
    mockPaginateIterator.mockReturnValue(makeAsyncIterator([{ data: [] }]));
    mockPaginate.mockResolvedValue([]);

    const events = await fetchAllGitHubEvents("owner", "repo", {
      kinds: ["commit_comment"],
    });

    // Only commit_comment iterator should be called
    expect(mockPaginateIterator).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(0);
  });

  it("tolerates individual fetcher failures (graceful degradation)", async () => {
    mockPaginateIterator.mockImplementation((endpoint: string) => {
      if (endpoint === "issues.listCommentsForRepo") {
        return makeAsyncIterator([
          {
            data: [
              {
                id: 5,
                user: { login: "grace" },
                created_at: "2024-07-01T00:00:00Z",
                html_url: "https://github.com/o/r/issues/2#c-5",
                issue_url: "https://api.github.com/repos/o/r/issues/2",
                body: "works",
              },
            ],
          },
        ]);
      }
      // Simulate failure for workflow_run
      throw new Error("API failure");
    });
    mockPaginate.mockResolvedValue([]);

    const events = await fetchAllGitHubEvents("owner", "repo", {
      kinds: ["issue_comment", "workflow_run"],
    });

    // Should still return the issue comment despite workflow failure
    expect(events.some((e) => e.kind === "issue_comment")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GitHubEvent shape invariants
// ---------------------------------------------------------------------------

describe("GitHubEvent shape", () => {
  it("every event has required fields", async () => {
    mockPaginateIterator.mockReturnValue(
      makeAsyncIterator([
        {
          data: [
            {
              id: 42,
              user: { login: "hank" },
              created_at: "2024-08-01T06:00:00Z",
              html_url: "https://github.com/o/r/issues/10#c-42",
              issue_url: "https://api.github.com/repos/o/r/issues/10",
              body: "test",
            },
          ],
        },
      ]),
    );

    const events = await fetchIssueComments("o", "r");
    for (const e of events) {
      expect(typeof e.kind).toBe("string");
      expect(typeof e.id).toBe("string");
      expect(typeof e.actor).toBe("string");
      expect(e.timestamp).toBeInstanceOf(Date);
      expect(typeof e.title).toBe("string");
      expect(typeof e.url).toBe("string");
      expect(typeof e.metadata).toBe("object");
    }
  });
});
