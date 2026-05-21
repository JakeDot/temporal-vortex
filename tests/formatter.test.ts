import { humanAge } from "../src/formatter";

describe("humanAge", () => {
  it("formats seconds", () => {
    expect(humanAge(45)).toBe("45s ago");
  });

  it("formats minutes", () => {
    expect(humanAge(90)).toBe("1m ago");
    expect(humanAge(3599)).toBe("59m ago");
  });

  it("formats hours", () => {
    expect(humanAge(3600)).toBe("1h ago");
    expect(humanAge(7200)).toBe("2h ago");
  });

  it("formats days", () => {
    expect(humanAge(86400)).toBe("1d ago");
    expect(humanAge(86400 * 6)).toBe("6d ago");
  });

  it("formats months", () => {
    expect(humanAge(86400 * 30)).toBe("1mo ago");
    expect(humanAge(86400 * 60)).toBe("2mo ago");
  });

  it("formats years", () => {
    expect(humanAge(86400 * 365)).toBe("1.0y ago");
    expect(humanAge(86400 * 730)).toBe("2.0y ago");
  });
});
