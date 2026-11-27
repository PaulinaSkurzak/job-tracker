import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

type Call = { url: string; method: string; csrf: string | null; body: unknown };

/** Replace fetch with a fake Django: records each request and answers the login POST with `loginStatus`. */
function fakeDjango(loginStatus: number, loginBody: unknown) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (request: Request) => {
    const body = request.method === "POST" ? await request.clone().json() : undefined;
    calls.push({ url: new URL(request.url).pathname, method: request.method, csrf: request.headers.get("X-CSRFToken"), body });
    if (request.url.endsWith("/api/auth/csrf/")) {
      document.cookie = "csrftoken=test-token"; // what Django's Set-Cookie would do
      return Response.json({ detail: "CSRF cookie set" });
    }
    return Response.json(loginBody, { status: loginStatus });
  });
  return calls;
}

async function submit(username = "paulina", password = "secret") {
  await userEvent.type(screen.getByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("gets a CSRF cookie, then posts credentials with the token header", async () => {
    const calls = fakeDjango(200, { id: 1, username: "paulina" });
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await submit();

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["GET /api/auth/csrf/", "POST /api/auth/login/"]);
    expect(calls[1].csrf).toBe("test-token");
    expect(calls[1].body).toEqual({ username: "paulina", password: "secret" });
    expect(onSuccess).toHaveBeenCalledWith({ id: 1, username: "paulina" });
  });

  it("shows the server's message when the password is wrong", async () => {
    fakeDjango(400, { detail: "Invalid username or password." });
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password.");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled(); // can try again
  });
});
