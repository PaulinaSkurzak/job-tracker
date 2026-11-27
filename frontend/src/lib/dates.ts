/**
 * The API sends calendar dates as "YYYY-MM-DD". `new Date("2026-11-30")` would read that as midnight UTC,
 * which is still Nov 29 in Boston, so build the date from its parts in local time instead.
 */
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDay(iso: string): string {
  return parseDay(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
