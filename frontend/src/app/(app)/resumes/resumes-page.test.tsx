import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fakeApi, json } from "@/test/fake-api";

import { ResumesPage } from "./resumes-page";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const RESUMES = [
  { id: 1, name: "Fall 2026", text: "Python SQL", is_active: true, created_at: "2026-09-01T12:00:00Z" },
  { id: 2, name: "Data engineering", text: "Airflow dbt", is_active: false, created_at: "2026-10-01T12:00:00Z" },
];

function renderPage(routes: Parameters<typeof fakeApi>[0] = {}) {
  const calls = fakeApi({ "GET /api/resumes/": json(RESUMES), ...routes });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ResumesPage />
    </QueryClientProvider>,
  );
  return calls;
}

describe("ResumesPage", () => {
  it("marks the active resume and offers to activate the others", async () => {
    renderPage();
    const items = await screen.findAllByRole("listitem");
    expect(within(items[0]).getByText("Active")).toBeInTheDocument();
    expect(within(items[0]).queryByRole("button", { name: /Make active/ })).not.toBeInTheDocument();
    expect(within(items[1]).getByRole("button", { name: /Make active/ })).toBeInTheDocument();
  });

  it("activates a resume", async () => {
    const calls = renderPage({ "POST /api/resumes/2/activate/": json({ ...RESUMES[1], is_active: true }) });
    await userEvent.click(await screen.findByRole("button", { name: /Make active/ }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/resumes/2/activate/")).toBe(true));
  });

  it("adds a resume", async () => {
    const calls = renderPage({ "POST /api/resumes/": json({ id: 3, name: "Healthcare", text: "SQL", is_active: false, created_at: "" }, 201) });
    await userEvent.click(await screen.findByRole("button", { name: "Add resume" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Healthcare");
    await userEvent.type(within(dialog).getByLabelText("Resume text"), "SQL, Tableau, HIPAA");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add resume" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ name: "Healthcare", text: "SQL, Tableau, HIPAA" }));
  });

  it("warns that deleting the active resume removes the scores", async () => {
    const calls = renderPage({ "DELETE /api/resumes/1/": () => new Response(null, { status: 204 }) });
    await userEvent.click(await screen.findByRole("button", { name: "Delete Fall 2026" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("applications will have no match score");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
  });
});
