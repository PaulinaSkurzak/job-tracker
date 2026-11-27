import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Dashboard } from "@/lib/dashboard";
import { fakeApi, json } from "@/test/fake-api";
import { renderWithProviders } from "@/test/render";

import { DashboardPage } from "./dashboard-page";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

const DATA: Dashboard = {
  today: "2026-11-26",
  stats: {
    active_applications: 8,
    applied_this_week: 1,
    weekly_goal: 5,
    applied_total: 11,
    reached_interview: 2,
    reached_interview_percent: 18,
    average_match: 59,
    scored_applications: 14,
  },
  funnel: [
    { label: "Applied", count: 11, percent: 100 },
    { label: "Screen / OA", count: 5, percent: 45 },
    { label: "Interview", count: 2, percent: 18 },
    { label: "Offer", count: 1, percent: 9 },
  ],
  weekly: ["10-05", "10-12", "10-19", "10-26", "11-02", "11-09", "11-16", "11-23"].map((d, i) => ({
    week_start: `2026-${d}`,
    count: [1, 2, 1, 2, 1, 1, 2, 1][i],
  })),
  follow_ups: [
    { id: 10, contact_id: 1, contact_name: "Priya Natarajan", company_name: "Bluefin Genomics", kind: "coffee_chat", notes: "Send a thank-you note.", follow_up_date: "2026-11-23", days_until: -3 },
    { id: 11, contact_id: 2, contact_name: "Dana Kim", company_name: "Meridian Analytics", kind: "email", notes: "Send an updated resume.", follow_up_date: "2026-11-27", days_until: 1 },
  ],
  deadlines: [{ id: 1, role_title: "Data Science Co-op", company_name: "Northwind Bio", deadline: "2026-11-30", days_until: 4, match_score: 74 }],
  gone_quiet: [{ id: 7, role_title: "Data Science Co-op", company_name: "Harbor Insurance", status: "applied", date_applied: "2026-11-10", days_quiet: 16 }],
};

/** A fake server that remembers PATCHes, so the refetch after a change returns the changed data (like Django). */
function statefulServer() {
  let state: Dashboard = structuredClone(DATA);
  return fakeApi({
    "GET /api/dashboard/": () => Response.json(state),
    "PATCH /api/interactions/10/": (_request, body) => {
      const patch = body as { follow_up_done?: boolean; follow_up_date?: string };
      const original = DATA.follow_ups.find((f) => f.id === 10)!;
      const others = state.follow_ups.filter((f) => f.id !== 10);
      if (patch.follow_up_done === true) state = { ...state, follow_ups: others };
      else if (patch.follow_up_done === false) state = { ...state, follow_ups: [original, ...others] };
      else if (patch.follow_up_date) {
        const days = patch.follow_up_date === original.follow_up_date ? original.days_until : 2;
        state = { ...state, follow_ups: [...others, { ...original, follow_up_date: patch.follow_up_date, days_until: days }] };
      }
      return Response.json({});
    },
  });
}

function renderPage() {
  return renderWithProviders(<DashboardPage />);
}

describe("DashboardPage", () => {
  beforeEach(() => vi.mocked(toast).mockClear());

  it("shows the date from the server, the to-do line and every section", async () => {
    fakeApi({ "GET /api/dashboard/": json(DATA) });
    renderPage();

    expect(await screen.findByText(/Thursday, Nov 26 · 2 follow-ups open, 1 late/)).toBeInTheDocument();
    const tiles = screen.getByRole("region", { name: "Key numbers" });
    expect(within(tiles).getByText("18%")).toBeInTheDocument();
    expect(within(tiles).getByText("2 of 11 applied")).toBeInTheDocument();
    expect(screen.getByText("Applications per week")).toBeInTheDocument();
    expect(screen.getByText(/11 applications in the last 8 weeks, 1 this week/)).toBeInTheDocument(); // screen reader summary
    expect(screen.getByText("3 days late")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    expect(screen.getByText("Nov 30 · 4d")).toBeInTheDocument();
    expect(screen.getByText("16 days")).toBeInTheDocument();
  });

  it("marks a follow-up done immediately, sends the PATCH and offers Undo", async () => {
    const calls = statefulServer();
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Mark Priya Natarajan done" }));

    expect(screen.queryByText("Priya Natarajan")).not.toBeInTheDocument(); // gone before the server answers
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ follow_up_done: true });

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const [, options] = vi.mocked(toast).mock.calls[0] as unknown as [string, { action: { onClick: () => void } }];
    options.action.onClick();
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(2));
    expect(calls.filter((c) => c.method === "PATCH")[1].body).toEqual({ follow_up_done: false });
    expect(await screen.findByText("Priya Natarajan")).toBeInTheDocument(); // back after Undo
  });

  it("snoozes to two days from today, and Undo restores the original date", async () => {
    const calls = statefulServer();
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Snooze Priya Natarajan for 2 days" }));

    expect(await screen.findByText("In 2 days")).toBeInTheDocument();
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Snoozed Priya Natarajan to Nov 28", expect.anything()));
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ follow_up_date: "2026-11-28" });

    const [, options] = vi.mocked(toast).mock.calls[0] as unknown as [string, { action: { onClick: () => void } }];
    options.action.onClick();
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(2));
    expect(calls.filter((c) => c.method === "PATCH")[1].body).toEqual({ follow_up_date: "2026-11-23" });
  });

  it("puts the row back and explains when the server rejects the change", async () => {
    fakeApi({
      "GET /api/dashboard/": json(DATA),
      "PATCH /api/interactions/10/": json({ detail: "Not found." }, 404),
    });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Mark Priya Natarajan done" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not update the follow-up: Not found."));
    expect(await screen.findByText("Priya Natarajan")).toBeInTheDocument();
  });

  it("shows friendly empty states", async () => {
    fakeApi({
      "GET /api/dashboard/": json({
        ...DATA,
        stats: { ...DATA.stats, average_match: null, scored_applications: 0 },
        funnel: DATA.funnel.map((s) => ({ ...s, count: 0, percent: 0 })),
        follow_ups: [],
        deadlines: [],
        gone_quiet: [],
      }),
    });
    renderPage();

    expect(await screen.findByText(/Nothing due/)).toBeInTheDocument();
    expect(screen.getByText(/All caught up/)).toBeInTheDocument();
    expect(screen.getByText(/the funnel starts filling in/)).toBeInTheDocument();
    expect(screen.getByText("Add a resume to score postings")).toBeInTheDocument();
    expect(screen.getByText(/No deadlines/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing has gone quiet/)).toBeInTheDocument();
  });
});
