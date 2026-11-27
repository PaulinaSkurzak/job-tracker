import type { Application, Status } from "@/lib/board";

let nextId = 1;

/** A made-up application with sensible defaults; override any field. */
export function makeApplication(overrides: Partial<Application> & { status?: Status } = {}): Application {
  const id = overrides.id ?? nextId++;
  return {
    id,
    company: { id, name: "Northwind Bio" },
    role_title: "Data Science Co-op",
    status: "saved",
    status_display: "Saved",
    position: 0,
    term: "Summer 2027",
    coop_months: 6,
    date_applied: null,
    deadline: null,
    match_score: 74,
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-01T12:00:00Z",
    ...overrides,
  };
}
