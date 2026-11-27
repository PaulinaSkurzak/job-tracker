/**
 * Django sets a `csrftoken` cookie (see GET /api/auth/csrf/). Every write request must echo it back
 * in the X-CSRFToken header; another website can't read our cookies, so it can't forge that header.
 */
export function readCookie(name: string, cookieString: string = document.cookie): string | null {
  for (const part of cookieString.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function needsCsrfToken(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}
