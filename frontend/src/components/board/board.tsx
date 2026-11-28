"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMemo, useRef, useState } from "react";

import { useMoveApplication } from "@/lib/applications";
import {
  findColumn,
  isColumnId,
  moveBetweenColumns,
  reorder,
  sameOrder,
  STATUS_LABELS,
  STATUSES,
  toColumns,
  type Application,
  type Columns,
  type Status,
} from "@/lib/board";

import { CardFace } from "./application-card";
import { ApplicationSheet } from "./application-sheet";
import { BoardColumn } from "./board-column";

type Drag = { id: number; columns: Columns; from: Status; fromIds: number[] };

/**
 * While a card is dragged, the board shows a local copy of the columns (`drag.columns`) that follows the
 * pointer across columns. On drop, the final column order is sent to the API; the cached list is updated
 * optimistically, so the board never waits for the server.
 */
export function Board({ applications, filtered }: { applications: Application[]; filtered: boolean }) {
  const { moveCard } = useMoveApplication();
  const [openId, setOpenId] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Drag events can fire before React re-renders, so the handlers read the latest drag state from a ref.
  const dragRef = useRef<Drag | null>(null);
  const setDragState = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const byId = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);
  const serverColumns = useMemo(() => toColumns(applications), [applications]);
  const columns = drag?.columns ?? serverColumns;

  const sensors = useSensors(
    // 5px of movement before a drag starts, so a plain click still opens the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Keyboard dragging: Space to pick up, arrow keys to move, Space to drop, Escape to cancel.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: {
      start: ["Space"], cancel: ["Escape"], end: ["Space"],
    } }),
  );

  function onDragStart({ active }: DragStartEvent) {
    const id = Number(active.id);
    const from = findColumn(serverColumns, id);
    if (from) setDragState({ id, columns: serverColumns, from, fromIds: serverColumns[from] });
  }

  function onDragOver({ over }: DragOverEvent) {
    const current = dragRef.current;
    if (!current || !over) return;
    const to = findColumn(current.columns, over.id);
    if (to) setDragState({ ...current, columns: moveBetweenColumns(current.columns, current.id, to, over.id) });
  }

  function onDragEnd({ over }: DragEndEvent) {
    const current = dragRef.current;
    setDragState(null);
    if (!current || !over) return;
    const to = findColumn(current.columns, over.id);
    if (!to) return;

    const ids = current.columns[to];
    const from = ids.indexOf(current.id);
    const target = isColumnId(over.id) ? ids.length - 1 : ids.indexOf(Number(over.id));
    const finalIds = target >= 0 && target !== from ? reorder(ids, from, target) : ids;

    if (to === current.from && sameOrder(finalIds, current.fromIds)) return; // dropped where it started
    moveCard({ id: current.id, status: to, ids: finalIds, undo: { status: current.from, ids: current.fromIds } });
  }

  // What screen readers hear while dragging with the keyboard (dnd-kit's defaults only say the id).
  const label = (id: string | number) => {
    const application = byId.get(Number(id));
    return application ? `${application.role_title} at ${application.company.name}` : "card";
  };
  const where = (id: string | number | undefined) => {
    const status = id === undefined || !drag ? undefined : findColumn(drag.columns, id);
    return status ? STATUS_LABELS[status] : "no column";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) => `${label(active.id)} is over ${where(over?.id)}.`,
    onDragEnd: ({ active, over }) => (over ? `Dropped ${label(active.id)} in ${where(over.id)}.` : `Dropped ${label(active.id)}.`),
    onDragCancel: ({ active }) => `Cancelled. ${label(active.id)} went back to where it was.`,
  };

  const dragged = drag ? byId.get(drag.id) : undefined;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        // Keep measuring every column during a drag. Keyboard dragging needs to know where the other columns
        // are to move into them; by default only the starting column is measured, so arrow keys went nowhere.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragState(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: "Press Enter to open. Press Space to pick up, arrow keys to move, Space to drop, Escape to cancel.",
          },
        }}
      >
        {/* A grid instead of one long row: 4 columns on wide screens (Saved to Interview on top, outcomes
            below), 2 on tablets, 1 on phones. Nothing scrolls sideways. */}
        <div className="pb-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                applications={columns[status].map((id) => byId.get(id)!).filter(Boolean)}
                // While a search is active only some cards are visible; reordering them would mis-number
                // the hidden ones, so dragging is paused until the search is cleared.
                dragDisabled={filtered}
                onOpen={setOpenId}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>{dragged ? <CardFace application={dragged} lifted /> : null}</DragOverlay>
      </DndContext>
      <ApplicationSheet id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
