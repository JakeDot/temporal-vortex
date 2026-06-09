# Contributing to temporal-vortex

> CLI for surfacing timestamped change events from git + GitHub API.

## Quick Start

```sh
npm run setup   # install, build, test in one step
```

## Development Workflow

```sh
npm run build   # compile TypeScript
npm test        # run test suite
npm run lint    # lint check
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):  
`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`

Git hooks are configured automatically by `npm run setup` — they validate commit messages on commit.

## Branch Strategy

All work goes on a `repo/temporal-vortex` branch (or feature branches off it) and opens a PR to `main`.

## Publishing

CI publishes automatically on merge to `main` via `publish.yml`. Do not publish manually.
