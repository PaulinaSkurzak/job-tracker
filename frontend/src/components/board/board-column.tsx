"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { columnId, STATUS_LABELS, type Application, type Status } from "@/lib/board";
import { cn } from "@/lib/utils";

import { SortableCard } from "./application-card";

export const STATUS_DOT: Record<Status, string> = {
  saved: "bg-zinc-400",
  applied: "bg-blue-500",
  screen: "bg-violet-500",
  interview: "bg-amber-500",
  offer: "bg-emerald-500",
  rejected: "bg-orange-600",
  withdrawn: "bg-zinc-500",
};

export function BoardColumn({
  status,
  applications,
  dragDisabled,
  onOpen,
}: {
  status: Status;
  applications: Application[];
  dragDisabled: boolean;
  onOpen: (id: number) => void;
}) {
  // The column itself is a drop target too, so a card can be dropped into an empty column.
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });

  return (
    <section aria-labelledby={`heading-${status}`} className="flex min-w-0 flex-col">
      <h2 id={`heading-${status}`} className="mb-2 flex items-center gap-2 px-1 text-sm font-medium">
        <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_DOT[status])} />
        {STATUS_LABELS[status]}
        <span className="text-muted-foreground">{applications.length}</span>
      </h2>
      <SortableContext id={columnId(status)} items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 rounded-xl p-1.5 transition-colors",
            isOver ? "bg-accent" : "bg-muted/40",
          )}
        >
          {applications.map((application) => (
            <SortableCard key={application.id} application={application} disabled={dragDisabled} onOpen={onOpen} />
          ))}
          {applications.length === 0 && (
            <p className="m-auto py-4 text-center text-xs text-muted-foreground">No applications</p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
