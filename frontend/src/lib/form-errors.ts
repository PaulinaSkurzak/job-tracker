import { ApiError } from "@/lib/api/client";

/**
 * Django REST Framework reports validation problems per field: {"email": ["Enter a valid email address."]}.
 * This turns that into { email: "Enter a valid email address." } so each message can sit under its input.
 * Errors that belong to no field ("detail", "non_field_errors") come back under "form".
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || typeof error.body !== "object" || error.body === null) {
    return error ? { form: "Something went wrong. Try again." } : {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(error.body as Record<string, unknown>)) {
    const message = Array.isArray(value) ? value.find((v) => typeof v === "string") : value;
    if (typeof message !== "string") continue;
    result[key === "detail" || key === "non_field_errors" ? "form" : key] = message;
  }
  return Object.keys(result).length ? result : { form: "Something went wrong. Try again." };
}
