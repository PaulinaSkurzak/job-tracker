import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactDetail } from "@/lib/contacts";
import { fakeApi, json } from "@/test/fake-api";
import { makeApplication } from "@/test/fixtures";

import { ContactDetailPage } from "./contact-detail-page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const PRIYA: ContactDetail = {
  id: 1,
  name: "Priya Natarajan",
  company: { id: 1, name: "Bluefin Genomics" },
  role: "Senior Data Scientist",
  email: "priya@example.com",
  linkedin_url: "",
  notes: "",
  applications: [5],
  interaction_count: 2,
  last_contacted: "2026-11-20",
  next_follow_up: "2026-11-23",
  interactions: [
    { id: 20, contact: 1, date: "2026-11-20", kind: "coffee_chat", kind_display: "Coffee chat", notes: "Talked about the platform team.", follow_up_date: "2026-11-23", follow_up_done: false },
    { id: 19, contact: 1, date: "2026-11-12", kind: "email", kind_display: "Email", notes: "Intro.", follow_up_date: null, follow_up_done: false },
  ],
};

function renderPage(routes: Parameters<typeof fakeApi>[0] = {}) {
  const calls = fakeApi({
    "GET /api/contacts/1/": json(PRIYA),
    "GET /api/applications/": json([makeApplication({ id: 5, role_title: "Data Science Co-op", company: { id: 1, name: "Bluefin Genomics" }, status: "screen" })]),
    "GET /api/dashboard/": json({ today: "2026-11-26" }),
    ...routes,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ContactDetailPage id={1} />
    </QueryClientProvider>,
  );
  return calls;
}

describe("ContactDetailPage", () => {
  beforeEach(() => push.mockClear());

  it("shows the contact, linked applications and the timeline newest first", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Priya Natarajan" })).toBeInTheDocument();
    expect(screen.getByText("Senior Data Scientist · Bluefin Genomics")).toBeInTheDocument();
    expect(await screen.findByText(/Data Science Co-op · Bluefin Genomics/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Email/ })).toHaveAttribute("href", "mailto:priya@example.com");

    const items = within(screen.getAllByRole("list").at(-1)!).getAllByRole("listitem");
    expect(items.map((li) => within(li).getByText(/Coffee chat|Email/).textContent)).toEqual(["Coffee chat", "Email"]);
    expect(screen.getByText("Follow up Nov 23 · 3 days late")).toBeInTheDocument();
  });

  it("logs an interaction, sending an empty follow-up as null", async () => {
    const calls = renderPage({ "POST /api/contacts/1/interactions/": json({ id: 21 }, 201) });
    const form = await screen.findByRole("form", { name: "Log an interaction" });

    await userEvent.clear(within(form).getByLabelText("Date"));
    await userEvent.type(within(form).getByLabelText("Date"), "2026-11-25");
    await userEvent.type(within(form).getByLabelText("Notes"), "Sent the thank-you note.");
    await userEvent.click(within(form).getByRole("button", { name: "Log interaction" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({
      date: "2026-11-25",
      kind: "email",
      notes: "Sent the thank-you note.",
      follow_up_date: null,
    });
  });

  it("shows the server's message next to the field it belongs to", async () => {
    renderPage({ "POST /api/contacts/1/interactions/": json({ date: ["Enter a valid date."] }, 400) });
    const form = await screen.findByRole("form", { name: "Log an interaction" });

    await userEvent.click(within(form).getByRole("button", { name: "Log interaction" }));

    const date = within(form).getByLabelText("Date");
    expect(await within(form).findByText("Enter a valid date.")).toBeInTheDocument();
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(date).toHaveAccessibleDescription("Enter a valid date.");
  });

  it("marks a follow-up done from the timeline", async () => {
    const calls = renderPage({ "PATCH /api/interactions/20/": json({}) });
    await userEvent.click(await screen.findByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ follow_up_done: true }));
  });

  it("asks before deleting, then goes back to the list", async () => {
    const calls = renderPage({ "DELETE /api/contacts/1/": () => new Response(null, { status: 204 }) });
    await userEvent.click(await screen.findByRole("button", { name: "Delete Priya Natarajan" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("This also deletes their 2 interactions.");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false); // nothing deleted until confirmed

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/contacts"));
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("explains a contact that doesn't exist", async () => {
    renderPage({ "GET /api/contacts/1/": json({ detail: "No Contact matches the given query." }, 404) });
    expect(await screen.findByRole("alert")).toHaveTextContent("This contact doesn't exist");
  });
});
