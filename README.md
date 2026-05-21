# temporal-vortex

> A GitLens-inspired CLI for surfacing timestamped change events from a git repository and the GitHub API.

## Developer Setup

### Git Hooks

This repository uses git hooks to enforce commit message standards and display commit information. Running `npm install` automatically configures your git repository to use the `.githooks/` directory for commit hooks on all platforms. If automatic setup fails, run the setup command manually:

```sh
git config core.hooksPath .githooks
```

**Note:** This modifies your local git configuration (`core.hooksPath`) only for this repository and does not affect other repositories. You can manually undo this with `git config --unset core.hooksPath`.

**Commit Message Hook:** The `commit-msg` hook rejects commits with the placeholder message "Initial Plan" to ensure meaningful commits are made to PRs. If you encounter this error, amend your commit with a real message:

```sh
git commit --amend -m "Your meaningful commit message"
```

**Post-Commit Hook:** The `post-commit` hook automatically runs `tv diff HEAD` after each successful commit to display timestamp information about the files you just committed. This helps you understand what files were touched and when they were last modified.

To temporarily disable hooks for a single commit, use the `--no-verify` flag:

```sh
git commit --no-verify -m "Your commit message"
```

To permanently disable hooks for this repository, unset the hooks path:

```sh
git config --unset core.hooksPath
```

To re-enable hooks later:

```sh
git config core.hooksPath .githooks
```

### Checking Out PRs

You can check out any pull request using one of these methods:

**Method 1: Clone/fetch a snapshot branch (easiest)**

Once a PR has a real commit (after the "Initial Plan" placeholder), a snapshot branch is automatically created at `snapshots/pr-<PR-NUMBER>`:

```sh
git fetch origin snapshots/pr-<PR-NUMBER>
git checkout snapshots/pr-<PR-NUMBER>
```

Or clone directly:

```sh
git clone --branch snapshots/pr-<PR-NUMBER> <your-repo-url>
```

**Method 2: Fetch PR directly using git refs (always works)**

```sh
git fetch origin refs/pull/<PR-NUMBER>/head:pr-<PR-NUMBER>
git checkout pr-<PR-NUMBER>
```

## Commands

### `tv log [file]`

Show commit history with color-coded age timestamps.

![tv log](docs/screenshots/log.svg)

### `tv summary [path]`

Show per-file timestamp statistics (newest change, first commit, commit count, authors).

![tv summary](docs/screenshots/summary.svg)

### `tv annotate <file>`

Per-line blame with age-colored timestamps, similar to `git blame`.

![tv annotate](docs/screenshots/annotate.svg)

### `tv diff [revision]`

Show timestamp information for files changed in a commit or revision (defaults to HEAD). Useful for understanding what files were touched and when. Automatically runs as a post-commit hook.

```sh
tv diff HEAD          # Show files changed in the most recent commit
tv diff abc123        # Show files changed in a specific commit
```

This command is automatically invoked after each commit via the post-commit hook (see [Git Hooks](#git-hooks) section).

### `tv --help`

![tv --help](docs/screenshots/help.svg)

## GitHub commands

```sh
# All timestamped events (comments, reviews, workflow runs)
tv github events <owner/repo>

# GitHub Actions workflow runs (agent start/end timestamps)
tv github workflows <owner/repo>
```

Requires a `GITHUB_TOKEN` env var or the `--token` flag.

## Install

```sh
npm install -g temporal-vortex
```

## Regenerate screenshots

```sh
npm run screenshot
```
