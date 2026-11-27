import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Contact } from "@/lib/contacts";

import { ContactsTable } from "./contacts-table";

const contact = (id: number, name: string, extra: Partial<Contact> = {}): Contact => ({
  id,
  name,
  company: null,
  role: "",
  email: "",
  linkedin_url: "",
  notes: "",
  applications: [],
  interaction_count: 0,
  last_contacted: null,
  next_follow_up: null,
  ...extra,
});

const CONTACTS = [
  contact(1, "Priya Natarajan", { company: { id: 1, name: "Bluefin Genomics" }, last_contacted: "2026-11-20", next_follow_up: "2026-11-23" }),
  contact(2, "Dana Kim", { company: { id: 2, name: "Meridian Analytics" }, last_contacted: "2026-11-22", next_follow_up: "2026-11-27" }),
  contact(3, "Alex New"), // no company, never contacted
];

const names = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("ContactsTable", () => {
  it("sorts by name by default and links each name to its page", () => {
    render(<ContactsTable contacts={CONTACTS} today="2026-11-26" />);
    expect(names()).toEqual(["Alex New", "Dana Kim", "Priya Natarajan"]);
    expect(screen.getByRole("link", { name: "Priya Natarajan" })).toHaveAttribute("href", "/contacts/1");
  });

  it("shows overdue follow-ups, and dashes for missing data", () => {
    render(<ContactsTable contacts={CONTACTS} today="2026-11-26" />);
    expect(screen.getByText("3 days late")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("keeps contacts without a follow-up last in both sort directions", async () => {
    render(<ContactsTable contacts={CONTACTS} today="2026-11-26" />);
    const sortButton = screen.getByRole("button", { name: /Next follow-up/ });

    await userEvent.click(sortButton);
    expect(names()).toEqual(["Priya Natarajan", "Dana Kim", "Alex New"]);
    expect(screen.getByRole("columnheader", { name: /Next follow-up/ })).toHaveAttribute("aria-sort", "ascending");

    await userEvent.click(sortButton);
    expect(names()).toEqual(["Dana Kim", "Priya Natarajan", "Alex New"]);
  });

  it("filters by name or company", async () => {
    render(<ContactsTable contacts={CONTACTS} today="2026-11-26" />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Filter by name or company" }), "meridian");
    expect(names()).toEqual(["Dana Kim"]);
    expect(screen.getByText("1 of 3 contacts")).toBeInTheDocument();

    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No contacts match “zzz”.")).toBeInTheDocument();
  });
});
