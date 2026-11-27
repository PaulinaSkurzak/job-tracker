import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { fakeApi, json } from "@/test/fake-api";
import { makeApplication } from "@/test/fixtures";

import { BoardPage } from "./board-page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BoardPage />
    </QueryClientProvider>,
  );
}

const apps = [
  makeApplication({ id: 1, role_title: "Data Science Co-op", company: { id: 1, name: "Northwind Bio" }, status: "saved", deadline: "2026-11-30" }),
  makeApplication({ id: 2, role_title: "ML Engineering Co-op", company: { id: 2, name: "Corvid Robotics" }, status: "interview", match_score: null }),
];

describe("BoardPage", () => {
  it("shows every column with its cards and counts", async () => {
    fakeApi({ "GET /api/applications/": json(apps) });
    renderPage();

    const saved = await screen.findByRole("region", { name: /Saved/ });
    expect(within(saved).getByText("Data Science Co-op")).toBeInTheDocument();
    expect(within(saved).getByText("Due Nov 30")).toBeInTheDocument(); // the date is not shifted a day by time zones
    expect(within(screen.getByRole("region", { name: /Interview/ })).getByText("no score")).toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(7);
    expect(screen.getByText(/2 applications/)).toBeInTheDocument();
  });

  it("filters by company or role and pauses dragging while searching", async () => {
    fakeApi({ "GET /api/applications/": json(apps) });
    renderPage();
    await screen.findByText("Data Science Co-op");

    await userEvent.type(screen.getByRole("searchbox", { name: "Search company or role" }), "corvid");

    expect(await screen.findByText(/Clear the search to drag cards/)).toBeInTheDocument();
    expect(screen.queryByText("Data Science Co-op")).not.toBeInTheDocument();
    expect(screen.getByText("ML Engineering Co-op")).toBeInTheDocument();
  });

  it("opens the detail panel with the status history when a card is clicked", async () => {
    fakeApi({
      "GET /api/applications/": json(apps),
      "GET /api/applications/2/": json({
        ...apps[1],
        status_display: "Interview",
        location: "Boston, MA",
        job_description: "",
        contacts: [{ id: 9, name: "Sam Ortiz" }],
        status_history: [
          { from_status: "", to_status: "applied", changed_at: "2026-11-03T15:00:00Z" },
          { from_status: "applied", to_status: "interview", changed_at: "2026-11-20T15:00:00Z" },
        ],
      }),
    });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "ML Engineering Co-op at Corvid Robotics" }));

    const panel = await screen.findByRole("dialog");
    expect(await within(panel).findByText("Corvid Robotics · Boston, MA")).toBeInTheDocument();
    expect(within(panel).getByText("Sam Ortiz")).toBeInTheDocument();
    expect(within(panel).getByText("Applied → Interview")).toBeInTheDocument();
    expect(within(panel).getByText("Added as Applied")).toBeInTheDocument();
  });

  it("explains an empty board", async () => {
    fakeApi({ "GET /api/applications/": json([]) });
    renderPage();
    expect(await screen.findByText("No applications yet")).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    fakeApi({ "GET /api/applications/": json({ detail: "Server error" }, 500) });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your applications.");
  });
});
