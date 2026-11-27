import { describe, expect, it } from "vitest";

import { needsCsrfToken, readCookie } from "./csrf";

describe("readCookie", () => {
  it("finds a cookie among several", () => {
    expect(readCookie("csrftoken", "sessionid=abc; csrftoken=tok123; theme=dark")).toBe("tok123");
  });

  it("does not match a cookie whose name only ends with the one asked for", () => {
    expect(readCookie("csrftoken", "xcsrftoken=nope")).toBeNull();
  });

  it("keeps '=' inside the value and decodes it", () => {
    expect(readCookie("a", "a=x%3Dy=z")).toBe("x=y=z");
  });

  it("returns null when absent", () => {
    expect(readCookie("csrftoken", "")).toBeNull();
  });
});

describe("needsCsrfToken", () => {
  it("is required for writes and not for reads", () => {
    expect(["POST", "PATCH", "put", "DELETE"].map(needsCsrfToken)).toEqual([true, true, true, true]);
    expect(["GET", "HEAD", "OPTIONS"].map(needsCsrfToken)).toEqual([false, false, false]);
  });
});
