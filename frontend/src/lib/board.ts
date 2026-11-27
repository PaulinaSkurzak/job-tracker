/**
 * Board logic as plain functions (no React, no network), so it is easy to test and reason about.
 */
import type { Schemas } from "@/lib/api/client";

export type Status = Schemas["ApplicationStatus"];
export type Application = Schemas["Application"];
export type Columns = Record<Status, number[]>; // column -> card ids, top to bottom

/** Column order and labels. Typed as Record<Status, ...> so adding a status in Django fails to compile here. */
export const STATUS_LABELS: Record<Status, string> = {
  saved: "Saved",
  applied: "Applied",
  screen: "Screen / OA",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
export const STATUSES = Object.keys(STATUS_LABELS) as Status[];

/** The API always returns a status; the schema marks it optional only because it has a default on create. */
export const statusOf = (application: Pick<Application, "status">): Status => application.status ?? "saved";

const COLUMN_PREFIX = "column:";
export const columnId = (status: Status) => `${COLUMN_PREFIX}${status}`;
export const isColumnId = (id: string | number): id is string => typeof id === "string" && id.startsWith(COLUMN_PREFIX);
export const statusFromColumnId = (id: string) => id.slice(COLUMN_PREFIX.length) as Status;

function emptyColumns(): Columns {
  return Object.fromEntries(STATUSES.map((status) => [status, []])) as unknown as Columns;
}

/** Group card ids by status, ordered by position (the API already sorts by position, then newest first). */
export function toColumns(applications: Application[]): Columns {
  const columns = emptyColumns();
  for (const application of [...applications].sort((a, b) => a.position - b.position)) {
    columns[statusOf(application)].push(application.id);
  }
  return columns;
}

/** Which column holds this id? Accepts a card id or a column id (dropping on an empty column). */
export function findColumn(columns: Columns, id: string | number): Status | undefined {
  if (isColumnId(id)) return statusFromColumnId(id);
  return STATUSES.find((status) => columns[status].includes(id as number));
}

/**
 * Move a card into another column while dragging, placing it where the pointer is (before `overId`)
 * or at the end when hovering the column itself. Returns new objects; never mutates.
 */
export function moveBetweenColumns(columns: Columns, cardId: number, to: Status, overId: string | number): Columns {
  const from = findColumn(columns, cardId);
  if (!from || from === to) return columns;
  const target = columns[to].filter((id) => id !== cardId);
  const overIndex = isColumnId(overId) ? -1 : target.indexOf(overId as number);
  target.splice(overIndex === -1 ? target.length : overIndex, 0, cardId);
  return { ...columns, [from]: columns[from].filter((id) => id !== cardId), [to]: target };
}

/** Reorder within a column (same idea as dnd-kit's arrayMove). */
export function reorder(ids: number[], fromIndex: number, toIndex: number): number[] {
  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Apply a move to the cached list the way the server will, so the board updates before the server answers
 * (an "optimistic update"). The card takes `status`, and `ids` sets the positions in that column.
 */
export function applyMove(applications: Application[], cardId: number, status: Status, ids: number[]): Application[] {
  const position = new Map(ids.map((id, index) => [id, index]));
  return applications.map((application) => {
    if (application.id === cardId) return { ...application, status, position: position.get(cardId) ?? 0 };
    if (statusOf(application) === status && position.has(application.id)) {
      return { ...application, position: position.get(application.id)! };
    }
    return application;
  });
}

export function sameOrder(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** Card colour band for the match score: green 75+, blue 60-74, orange below 60. */
export function matchTone(score: number | null): "high" | "mid" | "low" | "none" {
  if (score === null) return "none";
  return score >= 75 ? "high" : score >= 60 ? "mid" : "low";
}
