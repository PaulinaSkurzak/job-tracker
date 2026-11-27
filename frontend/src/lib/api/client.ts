import createClient, { type Middleware } from "openapi-fetch";

import { needsCsrfToken, readCookie } from "@/lib/csrf";

import type { components, paths } from "./schema";

/** Types generated from the Django API schema (npm run gen:api). */
export type Schemas = components["schemas"];

const csrf: Middleware = {
  onRequest({ request }) {
    if (needsCsrfToken(request.method)) {
      const token = readCookie("csrftoken");
      if (token) request.headers.set("X-CSRFToken", token);
    }
    return request;
  },
};

/**
 * Typed API client: `api.GET("/api/applications/{id}/", { params: { path: { id } } })` only compiles if
 * that path, its parameters and the response shape match the schema.
 *
 * The API is on the same origin (nginx routes /api/ to Django), so the browser sends the session
 * cookie automatically and no CORS setup is needed.
 */
export const api = createClient<paths>({
  baseUrl: typeof window === "undefined" ? "" : window.location.origin,
  credentials: "same-origin",
  // Look fetch up at call time (not import time) so tests can replace it.
  fetch: (request) => globalThis.fetch(request),
});
api.use(csrf);

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API request failed with status ${status}`);
  }
}

/** Turn an openapi-fetch result into data, or throw ApiError so TanStack Query treats it as a failure. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(result.response.status, result.error);
  }
  return result.data as T;
}

/** Best human-readable message from a DRF error body ({"detail": "..."} or {"field": ["..."]}). */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (!(error instanceof ApiError) || typeof error.body !== "object" || error.body === null) return fallback;
  const body = error.body as Record<string, unknown>;
  if (typeof body.detail === "string") return body.detail;
  const first = Object.values(body)[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  return fallback;
}
