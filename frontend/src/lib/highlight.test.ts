import { describe, expect, it } from "vitest";

import { segments } from "./highlight";

const text = "Python, SQL and Spark daily.";
const spans = [
  { start: 0, end: 6, skill: "Python" },
  { start: 8, end: 11, skill: "SQL" },
  { start: 16, end: 21, skill: "Spark" },
];

describe("segments", () => {
  it("splits the text into plain text and skills you have or are missing", () => {
    expect(segments(text, spans, new Set(["Python", "SQL"]))).toEqual([
      { text: "Python", kind: "have", skill: "Python" },
      { text: ", ", kind: "plain" },
      { text: "SQL", kind: "have", skill: "SQL" },
      { text: " and ", kind: "plain" },
      { text: "Spark", kind: "missing", skill: "Spark" },
      { text: " daily.", kind: "plain" },
    ]);
  });

  it("always rebuilds the original text exactly", () => {
    expect(segments(text, spans, new Set()).map((s) => s.text).join("")).toBe(text);
  });

  it("skips spans that no longer fit the text (it was edited after the request)", () => {
    const shorter = "Python, SQL";
    expect(segments(shorter, spans, new Set()).map((s) => s.text).join("")).toBe(shorter);
    expect(segments(shorter, spans, new Set()).filter((s) => s.kind !== "plain")).toHaveLength(2);
  });

  it("ignores overlapping and out-of-order spans without duplicating text", () => {
    const messy = [spans[2], { start: 2, end: 9, skill: "Odd" }, spans[0]];
    expect(segments(text, messy, new Set()).map((s) => s.text).join("")).toBe(text);
  });

  it("handles text with no skills", () => {
    expect(segments("Hello", [], new Set())).toEqual([{ text: "Hello", kind: "plain" }]);
  });
});
