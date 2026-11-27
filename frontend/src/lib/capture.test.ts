import { describe, expect, it } from "vitest";

import { bookmarkletCode, CAPTURE, MAX_TEXT, parseCapture, roleFromTitle } from "./capture";

describe("roleFromTitle", () => {
  it.each([
    ["Data Science Co-op - Northwind Bio | LinkedIn", "Data Science Co-op"],
    ["ML Engineering Co-op at Corvid Robotics", "ML Engineering Co-op"],
    ["Health Data Analyst Co-op | Halcyon Health Careers", "Health Data Analyst Co-op"],
    ["Co-op, Data Engineering – Vireo Bio", "Co-op, Data Engineering"], // the hyphen inside "Co-op" is not a separator
    ["", ""],
  ])("%s → %s", (title, role) => {
    expect(roleFromTitle(title)).toBe(role);
  });
});

describe("parseCapture", () => {
  const good = { type: CAPTURE, url: "https://jobs.example.com/123", title: "Data Co-op", text: "  Python and SQL.  " };

  it("accepts a well-formed capture and trims the text", () => {
    expect(parseCapture(good)).toEqual({ url: "https://jobs.example.com/123", title: "Data Co-op", text: "Python and SQL." });
  });

  it("rejects messages of the wrong shape or type", () => {
    expect(parseCapture(null)).toBeNull();
    expect(parseCapture("hello")).toBeNull();
    expect(parseCapture({ ...good, type: "something-else" })).toBeNull();
    expect(parseCapture({ ...good, text: 42 })).toBeNull();
  });

  it("drops URLs that aren't http(s), such as javascript: links", () => {
    expect(parseCapture({ ...good, url: "javascript:alert(1)" })?.url).toBe("");
    expect(parseCapture({ ...good, url: "not a url" })?.url).toBe("");
  });

  it("limits the length of every field", () => {
    const huge = parseCapture({ ...good, title: "t".repeat(1000), text: "x".repeat(MAX_TEXT * 2) })!;
    expect(huge.title).toHaveLength(300);
    expect(huge.text).toHaveLength(MAX_TEXT);
  });
});

describe("bookmarkletCode", () => {
  it("is a javascript: URL that only sends to the given origin", () => {
    const code = bookmarkletCode("http://localhost:8080");
    expect(code.startsWith("javascript:")).toBe(true);
    const source = decodeURIComponent(code.slice("javascript:".length));
    expect(source).toContain('window.open("http://localhost:8080/capture"');
    expect(source).toContain('popup.postMessage(data, "http://localhost:8080")');
    expect(source).toContain('event.origin === "http://localhost:8080"');
    expect(() => new Function(source)).not.toThrow(); // valid JavaScript
    // A new window per click, and each click answers once (see bookmarkletCode for the bug this prevents).
    expect(source).toContain('"_blank"');
    expect(source).toContain('removeEventListener("message", onMessage)');
  });
});
