# Command Screenshots

This directory contains screenshots of temporal-vortex commands in action. Each SVG file shows the terminal output of a specific command.

## Available Screenshots

### Git Commands

- **log.svg** - Output of `tv log [file]` command showing commit history
- **summary.svg** - Output of `tv summary [path]` command showing file-level statistics  
- **annotate.svg** - Output of `tv annotate <file>` command showing per-line blame
- **help.svg** - Output of `tv --help` command showing available commands

### GitHub Commands

- **github-events.svg** - Output of `tv github events <owner/repo>` command showing GitHub API events
- **github-workflows.svg** - Output of `tv github workflows <owner/repo>` command showing workflow runs

## Regenerating Screenshots

To generate fresh screenshots from the actual CLI output, run:

```bash
npm run screenshot
```

This command will execute each temporal-vortex command and capture its output as SVG files, overwriting the existing screenshots.

## Screenshot Format

All screenshots are in SVG (Scalable Vector Graphics) format with:
- Monospace font (SauceCodePro Nerd Font or fallback to Source Code Pro)
- Black background with light text for terminal-like appearance
- Color-coded output (green for timestamps, orange for event types, etc.)
- Proper scaling for responsive display

## Using Screenshots in Documentation

Screenshots are embedded in the main documentation via `<img>` tags and will scale responsively based on the viewport size. They maintain their aspect ratio while fitting the available width.
