import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAPTURE, READY } from "@/lib/capture";
import { fakeApi, json } from "@/test/fake-api";
import { makeApplication } from "@/test/fixtures";

import { CapturePage } from "./capture-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/capture" }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const POSTING = {
  type: CAPTURE,
  url: "https://jobs.example.com/northwind/123",
  title: "Data Science Co-op - Northwind Bio | Careers",
  text: "We use Python, SQL and Spark daily.",
};

/** A real window (an iframe's) to play the job page that opened us; jsdom requires a real one as a message source. */
function fakeJobPage() {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const jobPage = frame.contentWindow!;
  const postMessage = vi.spyOn(jobPage, "postMessage");
  Object.defineProperty(window, "opener", { value: jobPage, configurable: true });
  return { jobPage, postMessage };
}

function renderPage() {
  const calls = fakeApi({
    "GET /api/auth/me/": json({ id: 1, username: "paulina" }),
    "GET /api/companies/": json([]),
    "POST /api/match/": json({
      spans: [],
      results: [{ resume_id: 1, resume_name: "Fall 2026", is_active: true, score: 67, matched: ["Python", "SQL"], missing: ["Spark"] }],
    }),
    "POST /api/applications/": json({ ...makeApplication({ id: 9, role_title: "Data Science Co-op" }), match_score: 67 }, 201),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CapturePage />
    </QueryClientProvider>,
  );
  return calls;
}

const send = (data: unknown, source: Window) =>
  act(() => window.dispatchEvent(new MessageEvent("message", { data, source })));

describe("CapturePage", () => {
  afterEach(() => {
    Object.defineProperty(window, "opener", { value: null, configurable: true });
    document.querySelectorAll("iframe").forEach((f) => f.remove());
  });

  it("opened directly, explains the bookmarklet and offers it to drag", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: /Save to Job Tracker/ });
    expect(link.getAttribute("href")).toMatch(/^javascript:/);
    expect(screen.getByText(/select the job description/)).toBeInTheDocument();
  });

  it("tells the job page it's ready, then pre-fills the form from its message", async () => {
    const { jobPage, postMessage } = fakeJobPage();
    renderPage();

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith(READY, "*"));
    expect(screen.getByText("Waiting for the job page…")).toBeInTheDocument();

    send(POSTING, jobPage);

    expect(await screen.findByLabelText("Role")).toHaveValue("Data Science Co-op");
    expect(screen.getByLabelText("Job posting URL")).toHaveValue(POSTING.url);
    expect(screen.getByLabelText("Job description")).toHaveValue(POSTING.text);
    expect(await screen.findByText("67% match with Fall 2026. Missing: Spark.")).toBeInTheDocument();
  });

  it("saves only when you click Add, with what the job page sent", async () => {
    const { jobPage } = fakeJobPage();
    const calls = renderPage();
    await waitFor(() => expect(screen.getByText("Waiting for the job page…")).toBeInTheDocument());
    send(POSTING, jobPage);

    await userEvent.type(await screen.findByLabelText("Company"), "Northwind Bio");
    expect(calls.some((c) => c.path === "/api/applications/")).toBe(false); // nothing saved yet
    await userEvent.click(screen.getByRole("button", { name: "Add application" }));

    await waitFor(() => expect(calls.find((c) => c.path === "/api/applications/")).toBeDefined());
    expect(calls.find((c) => c.path === "/api/applications/")!.body).toMatchObject({
      company_name: "Northwind Bio",
      role_title: "Data Science Co-op",
      job_url: POSTING.url,
      job_description: POSTING.text,
    });
    expect(await screen.findByRole("button", { name: "Close window" })).toBeInTheDocument();
  });

  it("ignores messages from any window other than the one that opened it", async () => {
    fakeJobPage();
    const other = document.body.appendChild(document.createElement("iframe")).contentWindow!;
    renderPage();
    await waitFor(() => expect(screen.getByText("Waiting for the job page…")).toBeInTheDocument());

    send(POSTING, other);

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText("Waiting for the job page…")).toBeInTheDocument();
  });

  it("ignores malformed messages from the job page", async () => {
    const { jobPage } = fakeJobPage();
    renderPage();
    await waitFor(() => expect(screen.getByText("Waiting for the job page…")).toBeInTheDocument());

    send({ type: CAPTURE, url: 123 }, jobPage);
    send("hello", jobPage);

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText("Waiting for the job page…")).toBeInTheDocument();
  });
});
