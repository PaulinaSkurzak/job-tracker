import { describe, expect, it } from "vitest";

import { makeApplication } from "@/test/fixtures";

import {
  applyMove,
  columnId,
  findColumn,
  matchTone,
  moveBetweenColumns,
  reorder,
  STATUSES,
  toColumns,
  type Columns,
} from "./board";

const cols = (partial: Partial<Columns>): Columns => ({ ...toColumns([]), ...partial });

describe("toColumns", () => {
  it("has every status, in board order, and sorts cards by position", () => {
    const columns = toColumns([
      makeApplication({ id: 1, status: "applied", position: 1 }),
      makeApplication({ id: 2, status: "applied", position: 0 }),
      makeApplication({ id: 3, status: "offer" }),
    ]);
    expect(Object.keys(columns)).toEqual(STATUSES);
    expect(columns.applied).toEqual([2, 1]);
    expect(columns.offer).toEqual([3]);
    expect(columns.saved).toEqual([]);
  });
});

describe("findColumn", () => {
  it("finds the column of a card or of a column id", () => {
    const columns = cols({ applied: [1, 2] });
    expect(findColumn(columns, 2)).toBe("applied");
    expect(findColumn(columns, columnId("offer"))).toBe("offer");
    expect(findColumn(columns, 99)).toBeUndefined();
  });
});

describe("moveBetweenColumns", () => {
  const start = cols({ saved: [1, 2], applied: [3, 4] });

  it("inserts the card before the card it is over", () => {
    const next = moveBetweenColumns(start, 1, "applied", 4);
    expect(next.saved).toEqual([2]);
    expect(next.applied).toEqual([3, 1, 4]);
  });

  it("appends when hovering the column itself (e.g. an empty column)", () => {
    expect(moveBetweenColumns(start, 1, "offer", columnId("offer")).offer).toEqual([1]);
  });

  it("does nothing within the same column, and never mutates the input", () => {
    expect(moveBetweenColumns(start, 1, "saved", 2)).toBe(start);
    moveBetweenColumns(start, 1, "applied", 4);
    expect(start.saved).toEqual([1, 2]);
  });
});

describe("reorder", () => {
  it("moves one item and keeps the rest in order", () => {
    expect(reorder([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(reorder([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
  });
});

describe("applyMove", () => {
  it("changes the moved card's status and renumbers that column, leaving other columns alone", () => {
    const apps = [
      makeApplication({ id: 1, status: "saved", position: 0 }),
      makeApplication({ id: 2, status: "applied", position: 0 }),
      makeApplication({ id: 3, status: "applied", position: 1 }),
      makeApplication({ id: 4, status: "offer", position: 5 }),
    ];
    const next = applyMove(apps, 1, "applied", [2, 1, 3]);
    const summary = next.map((a) => [a.id, a.status, a.position]);
    expect(summary).toEqual([
      [1, "applied", 1],
      [2, "applied", 0],
      [3, "applied", 2],
      [4, "offer", 5],
    ]);
    expect(apps[0].status).toBe("saved"); // input untouched
  });
});

describe("matchTone", () => {
  it.each([
    [null, "none"],
    [80, "high"],
    [75, "high"],
    [74, "mid"],
    [60, "mid"],
    [59, "low"],
  ] as const)("score %s is %s", (score, tone) => {
    expect(matchTone(score)).toBe(tone);
  });
});
