import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fakeApi, json } from "@/test/fake-api";
import { makeApplication } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";

import { CommandMenu } from "./command-menu";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const apps = [
  makeApplication({ id: 1, role_title: "Data Science Co-op", company: { id: 1, name: "Northwind Bio" }, status: "applied" }),
  makeApplication({ id: 2, role_title: "ML Engineering Co-op", company: { id: 2, name: "Corvid Robotics" } }),
];
const contacts = [
  {
    id: 7,
    name: "Sam Ortiz",
    company: { id: 2, name: "Corvid Robotics" },
    role: "Recruiter",
    interaction_count: 0,
    last_contacted: null,
    next_follow_up: null,
  },
];

function renderMenu() {
  fakeApi({
    "GET /api/applications/": json(apps),
    "GET /api/contacts/": json(contacts),
    "GET /api/applications/1/": json({ ...apps[0], location: "", job_description: "", contacts: [], status_history: [] }),
  });
  return renderWithProviders(<CommandMenu open onOpenChange={() => {}} />);
}

describe("CommandMenu", () => {
  it("finds applications by company and contacts by name", async () => {
    renderMenu();
    const input = screen.getByPlaceholderText("Search applications, contacts, pages…");
    await screen.findByText("Data Science Co-op");

    await userEvent.type(input, "northwind");
    expect(screen.getByText("Data Science Co-op")).toBeInTheDocument();
    expect(screen.queryByText("ML Engineering Co-op")).not.toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "sam");
    expect(screen.getByText("Sam Ortiz")).toBeInTheDocument();
    expect(screen.queryByText("Data Science Co-op")).not.toBeInTheDocument();
  });

  it("opens an application's detail panel", async () => {
    renderMenu();
    await userEvent.click(await screen.findByText("Data Science Co-op"));
    expect(await screen.findByRole("heading", { name: "Data Science Co-op" })).toBeInTheDocument();
  });

  it("goes to a contact's page", async () => {
    renderMenu();
    await userEvent.click(await screen.findByText("Sam Ortiz"));
    expect(push).toHaveBeenCalledWith("/contacts/7");
  });
});
