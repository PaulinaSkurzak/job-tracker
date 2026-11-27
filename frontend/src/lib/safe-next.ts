/**
 * After login we send the user back to the page they asked for (`/login?next=/board`). That value
 * comes from the URL, so anyone can craft it: only accept a path on this site, never a full URL.
 * "//evil.com" and "/\evil.com" look like paths but browsers treat them as other sites.
 */
export const DEFAULT_PAGE = "/dashboard";

export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_PAGE;
  }
  if (next === "/login" || next.startsWith("/login?")) return DEFAULT_PAGE; // avoid a login loop
  return next;
}
