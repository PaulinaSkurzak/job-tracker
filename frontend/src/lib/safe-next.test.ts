import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE, safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps a path on this site, including its query string", () => {
    expect(safeNextPath("/board")).toBe("/board");
    expect(safeNextPath("/contacts?q=priya")).toBe("/contacts?q=priya");
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["a full URL", "https://evil.example/phish"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a relative path", "board"],
  ])("falls back to the default for %s", (_label, value) => {
    expect(safeNextPath(value)).toBe(DEFAULT_PAGE);
  });

  it("never sends you back to the login page", () => {
    expect(safeNextPath("/login")).toBe(DEFAULT_PAGE);
    expect(safeNextPath("/login?next=/board")).toBe(DEFAULT_PAGE);
  });
});
