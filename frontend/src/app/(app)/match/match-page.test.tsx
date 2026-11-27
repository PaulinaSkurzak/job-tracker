import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fakeApi, json, type Recorded } from "@/test/fake-api";
import { makeApplication } from "@/test/fixtures";

import { MatchPage } from "./match-page";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const JD = "We use Python, SQL and Spark daily.";
const RESUMES = [
  { id: 1, name: "Fall 2026", text: "", is_active: true, created_at: "2026-09-01T12:00:00Z" },
  { id: 2, name: "Data engineering", text: "", is_active: false, created_at: "2026-10-01T12:00:00Z" },
];

/** A fake /api/match/ that scores any text the same way: Python and SQL matched, Spark missing. */
function matchFor(body: unknown) {
  const text = (body as { job_description: string }).job_description;
  const spans = ["Python", "SQL", "Spark"]
    .map((skill) => ({ skill, start: text.indexOf(skill), end: text.indexOf(skill) + skill.length }))
    .filter((s) => s.start >= 0);
  return Response.json({
    spans,
    results: [
      { resume_id: 1, resume_name: "Fall 2026", is_active: true, score: 67, matched: ["Python", "SQL"], missing: ["Spark"] },
      { resume_id: 2, resume_name: "Data engineering", is_active: false, score: 100, matched: ["Python", "SQL", "Spark"], missing: [] },
    ],
  });
}

function renderPage(routes: Parameters<typeof fakeApi>[0] = {}) {
  const calls = fakeApi({
    "GET /api/resumes/": json(RESUMES),
    "GET /api/applications/": json([makeApplication({ id: 5, role_title: "Data Science Co-op", company: { id: 1, name: "Northwind Bio" } })]),
    "POST /api/match/": (_request, body) => matchFor(body),
    ...routes,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MatchPage />
    </QueryClientProvider>,
  );
  return calls;
}

const matchCalls = (calls: Recorded[]) => calls.filter((c) => c.path === "/api/match/");

describe("MatchPage", () => {
  it("scores once typing pauses, not on every keystroke", async () => {
    const calls = renderPage();
    await userEvent.type(screen.getByLabelText("Text"), JD);

    expect(await screen.findByText("2 of 3 skills in the posting")).toBeInTheDocument();
    expect(screen.getAllByText("67%")[0]).toBeInTheDocument();
    expect(matchCalls(calls)).toHaveLength(1); // 36 keystrokes, one request
    expect(matchCalls(calls)[0].body).toEqual({ job_description: JD });
  });

  it("highlights skills in the posting and lists what is missing", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Text"), JD);

    const highlighted = await screen.findByRole("region", { name: "Highlighted" });
    const marks = within(highlighted).getAllByText((_, el) => el?.tagName === "MARK");
    expect(marks.map((m) => [m.textContent, m.getAttribute("title")])).toEqual([
      ["Python", "Python: in your resume"],
      ["SQL", "SQL: in your resume"],
      ["Spark", "Spark: missing"],
    ]);
    expect(highlighted).toHaveTextContent(JD); // the original text, intact
    expect(screen.getByText("2 of 3 skills in the posting")).toBeInTheDocument();
  });

  it("compares every resume, best first", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Text"), JD);

    const compare = (await screen.findByText("Compare resumes")).closest("[data-slot=card]") as HTMLElement;
    const rows = within(compare).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual(["Data engineering 100%", "Fall 2026 (active)67%"]);
  });

  it("says so when the posting has no known skills", async () => {
    renderPage({
      "POST /api/match/": json({ spans: [], results: [{ ...RESUMES[0], resume_id: 1, resume_name: "Fall 2026", score: null, matched: [], missing: [] }] }),
    });
    await userEvent.type(screen.getByLabelText("Text"), "Friendly team, great snacks.");
    expect(await screen.findByText(/No skills from the vocabulary/)).toBeInTheDocument();
  });

  it("points to the Resumes page when there are no resumes", async () => {
    renderPage({ "GET /api/resumes/": json([]) });
    expect(await screen.findByRole("link", { name: "Go to Resumes" })).toHaveAttribute("href", "/resumes");
  });

  it("loads an application's description and saves edits back to it", async () => {
    const calls = renderPage({
      "GET /api/applications/5/": json({ ...makeApplication({ id: 5 }), job_description: "Python and SQL.", status_history: [], contacts: [] }),
      "PATCH /api/applications/5/": json({ ...makeApplication({ id: 5 }), match_score: 67 }),
    });
    await userEvent.click(screen.getByRole("combobox", { name: "Application" }));
    await userEvent.click(await screen.findByRole("option", { name: "Data Science Co-op · Northwind Bio" }));

    const textarea = screen.getByLabelText("Text");
    await waitFor(() => expect(textarea).toHaveValue("Python and SQL."));
    expect(screen.queryByRole("button", { name: "Save description to application" })).not.toBeInTheDocument(); // unchanged

    await userEvent.type(textarea, " Spark too.");
    await userEvent.click(screen.getByRole("button", { name: "Save description to application" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ job_description: "Python and SQL. Spark too." }));
  });
});
