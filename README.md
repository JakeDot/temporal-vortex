# temporal-vortex

> A GitLens-inspired CLI for surfacing timestamped change events from a git repository and the GitHub API.

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
