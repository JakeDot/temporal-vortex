import { parsePorcelainBlame, parseLogOutput } from "../src/git";

// ---------------------------------------------------------------------------
// parsePorcelainBlame
// ---------------------------------------------------------------------------

describe("parsePorcelainBlame", () => {
  const PORCELAIN = [
    "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 1 1 1",
    "author Jane Doe",
    "author-mail <jane@example.com>",
    "author-time 1700000000",
    "author-tz +0000",
    "committer Jane Doe",
    "committer-mail <jane@example.com>",
    "committer-time 1700000000",
    "committer-tz +0000",
    "summary initial commit",
    "filename README.md",
    "\thello world",
    "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3 2 2 1",
    "author John Smith",
    "author-mail <john@example.com>",
    "author-time 1710000000",
    "author-tz +0200",
    "committer John Smith",
    "committer-mail <john@example.com>",
    "committer-time 1710000000",
    "committer-tz +0200",
    "summary second commit",
    "filename README.md",
    "\tsecond line",
  ].join("\n");

  it("returns one entry per line", () => {
    const entries = parsePorcelainBlame(PORCELAIN);
    expect(entries).toHaveLength(2);
  });

  it("parses commit hash correctly", () => {
    const entries = parsePorcelainBlame(PORCELAIN);
    expect(entries[0].commit).toBe("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
    expect(entries[1].commit).toBe("b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3");
  });

  it("parses author names", () => {
    const entries = parsePorcelainBlame(PORCELAIN);
    expect(entries[0].author).toBe("Jane Doe");
    expect(entries[1].author).toBe("John Smith");
  });

  it("parses timestamps as Date objects", () => {
    const entries = parsePorcelainBlame(PORCELAIN);
    expect(entries[0].timestamp).toBeInstanceOf(Date);
    expect(entries[0].timestamp.getTime()).toBe(1700000000 * 1000);
  });

  it("treats author-time as a UTC epoch regardless of author-tz", () => {
    const entries = parsePorcelainBlame(PORCELAIN);
    // author-time is always a UTC Unix timestamp; author-tz is for display only.
    expect(entries[1].timestamp.getTime()).toBe(1710000000 * 1000);
  });

  it("parses line numbers", () => {
    const entries = parsePorcelainBlame(PORCELAIN);
    expect(entries[0].lineNumber).toBe(1);
    expect(entries[1].lineNumber).toBe(2);
  });

  it("parses line content (strips leading tab)", () => {
    const entries = parsePorcelainBlame(PORCELAIN);
    expect(entries[0].content).toBe("hello world");
    expect(entries[1].content).toBe("second line");
  });

  it("returns empty array for empty input", () => {
    expect(parsePorcelainBlame("")).toHaveLength(0);
    expect(parsePorcelainBlame("\n\n")).toHaveLength(0);
  });

  it("handles repeated same-commit blocks (shared metadata)", () => {
    // git blame --porcelain emits metadata once per unique commit
    const SHARED = [
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 2",
      "author Alice",
      "author-mail <alice@example.com>",
      "author-time 1600000000",
      "author-tz +0000",
      "summary first",
      "filename foo.ts",
      "\tline one",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2 2",
      "\tline two",
    ].join("\n");
    const entries = parsePorcelainBlame(SHARED);
    expect(entries).toHaveLength(2);
    expect(entries[0].author).toBe("Alice");
    expect(entries[1].author).toBe("Alice");
    expect(entries[0].content).toBe("line one");
    expect(entries[1].content).toBe("line two");
  });
});

// ---------------------------------------------------------------------------
// parseLogOutput
// ---------------------------------------------------------------------------

describe("parseLogOutput", () => {
  const SEP = "\x1f";
  const LINE1 = [
    "abc1234abc1234abc1234abc1234abc1234abc1234",
    "Alice",
    "alice@example.com",
    "1700000000",
    "Initial commit",
  ].join(SEP);
  const LINE2 = [
    "def5678def5678def5678def5678def5678def5678",
    "Bob",
    "bob@example.com",
    "1690000000",
    "Fix bug",
  ].join(SEP);

  it("parses multiple commits", () => {
    const entries = parseLogOutput([LINE1, LINE2].join("\n"));
    expect(entries).toHaveLength(2);
  });

  it("parses commit hashes", () => {
    const entries = parseLogOutput(LINE1);
    expect(entries[0].commit).toBe("abc1234abc1234abc1234abc1234abc1234abc1234");
  });

  it("parses author name and email", () => {
    const entries = parseLogOutput(LINE1);
    expect(entries[0].author).toBe("Alice");
    expect(entries[0].authorEmail).toBe("alice@example.com");
  });

  it("parses timestamps", () => {
    const entries = parseLogOutput(LINE1);
    expect(entries[0].timestamp).toBeInstanceOf(Date);
    expect(entries[0].timestamp.getTime()).toBe(1700000000 * 1000);
  });

  it("parses commit message", () => {
    const entries = parseLogOutput(LINE1);
    expect(entries[0].message).toBe("Initial commit");
  });

  it("preserves separator in message if present", () => {
    const weirdMsg = ["hash1234hash1234hash1234hash1234hash1234hash1234", "Author", "a@b.com", "1700000000", `Part1${SEP}Part2`].join(SEP);
    const entries = parseLogOutput(weirdMsg);
    expect(entries[0].message).toBe(`Part1${SEP}Part2`);
  });

  it("skips blank lines", () => {
    const entries = parseLogOutput(`\n${LINE1}\n\n${LINE2}\n`);
    expect(entries).toHaveLength(2);
  });

  it("skips malformed lines", () => {
    const entries = parseLogOutput("not-enough-fields");
    expect(entries).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(parseLogOutput("")).toHaveLength(0);
  });
});
