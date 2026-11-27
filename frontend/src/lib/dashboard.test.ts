import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  dueLabel,
  snoozedDate,
  todoLine,
  withFollowUpDate,
  withoutFollowUp,
  type Dashboard,
  type FollowUp,
} from "./dashboard";

const followUp = (id: number, days_until: number, follow_up_date = "2026-11-26"): FollowUp => ({
  id,
  contact_id: id,
  contact_name: `Contact ${id}`,
  company_name: "Bluefin",
  kind: "email",
  notes: "",
  follow_up_date,
  days_until,
});

describe("dueLabel", () => {
  it.each([
    [-3, "3 days late"],
    [-1, "1 day late"],
    [0, "Today"],
    [1, "Tomorrow"],
    [4, "In 4 days"],
  ])("%i days is %s", (days, label) => {
    expect(dueLabel(days)).toBe(label);
  });
});

describe("todoLine", () => {
  it("counts open and late follow-ups", () => {
    expect(todoLine([])).toBe("Nothing due");
    expect(todoLine([followUp(1, 2)])).toBe("1 follow-up open");
    expect(todoLine([followUp(1, -2), followUp(2, -1), followUp(3, 4)])).toBe("3 follow-ups open, 2 late");
  });
});

describe("date arithmetic on calendar dates", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is not thrown off by daylight saving time (Nov 1, 2026 in Boston)", () => {
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("snoozes to two days from today, not from the old due date", () => {
    expect(snoozedDate("2026-11-26")).toBe("2026-11-28");
  });
});

describe("optimistic follow-up edits", () => {
  const data = {
    today: "2026-11-26",
    follow_ups: [followUp(1, -3, "2026-11-23"), followUp(2, 1, "2026-11-27"), followUp(3, 4, "2026-11-30")],
  } as Dashboard;

  it("removes a follow-up marked done, without mutating the original", () => {
    expect(withoutFollowUp(data, 1).follow_ups.map((f) => f.id)).toEqual([2, 3]);
    expect(data.follow_ups).toHaveLength(3);
  });

  it("reschedules a snoozed follow-up, recomputes days_until and keeps the list sorted by date", () => {
    const next = withFollowUpDate(data, 1, "2026-11-28");
    expect(next.follow_ups.map((f) => [f.id, f.days_until])).toEqual([
      [2, 1],
      [1, 2],
      [3, 4],
    ]);
  });
});
