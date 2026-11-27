import { vi } from "vitest";

type Handler = (request: Request, body: unknown) => Response | Promise<Response>;
export type Recorded = { method: string; path: string; body: unknown };

/**
 * Replace fetch with a tiny fake API. Routes are "METHOD /path/" strings; unknown routes return 404 so a
 * test fails loudly instead of hanging. Returns the list of requests made, for assertions.
 */
export function fakeApi(routes: Record<string, Handler>) {
  const calls: Recorded[] = [];
  vi.stubGlobal("fetch", async (request: Request) => {
    const path = new URL(request.url).pathname;
    const text = request.method === "GET" ? "" : await request.clone().text();
    const body = text ? JSON.parse(text) : undefined;
    calls.push({ method: request.method, path, body });
    const handler = routes[`${request.method} ${path}`];
    return handler ? handler(request, body) : Response.json({ detail: "Not found" }, { status: 404 });
  });
  return calls;
}

export const json = (data: unknown, status = 200) => () => Response.json(data, { status });
