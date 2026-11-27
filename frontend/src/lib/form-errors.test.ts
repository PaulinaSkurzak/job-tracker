import { describe, expect, it } from "vitest";

import { ApiError } from "./api/client";
import { fieldErrors } from "./form-errors";

describe("fieldErrors", () => {
  it("takes the first message for each field", () => {
    const error = new ApiError(400, { email: ["Enter a valid email address.", "Too long."], name: ["Required."] });
    expect(fieldErrors(error)).toEqual({ email: "Enter a valid email address.", name: "Required." });
  });

  it("puts detail and non-field errors under 'form'", () => {
    expect(fieldErrors(new ApiError(403, { detail: "Forbidden." }))).toEqual({ form: "Forbidden." });
    expect(fieldErrors(new ApiError(400, { non_field_errors: ["Bad combination."] }))).toEqual({ form: "Bad combination." });
  });

  it("falls back to a generic message for errors it can't read", () => {
    expect(fieldErrors(new Error("network down"))).toEqual({ form: "Something went wrong. Try again." });
    expect(fieldErrors(new ApiError(500, "<html>"))).toEqual({ form: "Something went wrong. Try again." });
  });

  it("returns nothing when there is no error", () => {
    expect(fieldErrors(null)).toEqual({});
  });
});
