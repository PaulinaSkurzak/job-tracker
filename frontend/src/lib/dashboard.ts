/** Dashboard helpers as plain functions, so they are easy to test. */
import type { Schemas } from "@/lib/api/client";
import { parseDay } from "@/lib/dates";

export type Dashboard = Schemas["Dashboard"];
export type FollowUp = Schemas["FollowUp"];

/** "3 days late", "Today", "Tomorrow", "In 4 days". */
export function dueLabel(daysUntil: number): string {
  if (daysUntil < -1) return `${-daysUntil} days late`;
  if (daysUntil === -1) return "1 day late";
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
}

/** The line under the page title: "4 follow-ups open, 2 late" or "Nothing due". */
export function todoLine(followUps: FollowUp[]): string {
  if (followUps.length === 0) return "Nothing due";
  const late = followUps.filter((f) => f.days_until < 0).length;
  const open = `${followUps.length} follow-up${followUps.length === 1 ? "" : "s"} open`;
  return late ? `${open}, ${late} late` : open;
}

/** Add days to a "YYYY-MM-DD" date, returning the same format (local calendar, no time zone shifts). */
export function addDays(iso: string, days: number): string {
  const date = parseDay(iso);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseDay(toIso).getTime() - parseDay(fromIso).getTime()) / 86_400_000);
}

export const SNOOZE_DAYS = 2;

/** Snoozing moves the follow-up to 2 days from today (not from its old date, which may be long past). */
export function snoozedDate(today: string): string {
  return addDays(today, SNOOZE_DAYS);
}

/** Optimistic cache edits for the follow-up actions. Return new objects; never mutate. */
export function withoutFollowUp(data: Dashboard, id: number): Dashboard {
  return { ...data, follow_ups: data.follow_ups.filter((f) => f.id !== id) };
}

export function withFollowUpDate(data: Dashboard, id: number, date: string): Dashboard {
  const follow_ups = data.follow_ups
    .map((f) => (f.id === id ? { ...f, follow_up_date: date, days_until: daysBetween(data.today, date) } : f))
    .sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date) || a.id - b.id);
  return { ...data, follow_ups };
}

/** Labels for the x axis: "Nov 23" for each week's Monday. */
export function weekLabel(weekStart: string): string {
  return parseDay(weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
