"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { matchTone, statusOf, type Application } from "@/lib/board";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

const TONE_BAR = {
  high: "bg-emerald-500",
  mid: "bg-blue-500",
  low: "bg-orange-500",
  none: "bg-transparent",
} as const;

function meta(application: Application): string {
  if (statusOf(application) === "saved" && application.deadline) return `Due ${formatDay(application.deadline)}`;
  if (application.date_applied) return `Applied ${formatDay(application.date_applied)}`;
  return application.term ?? "";
}

/** The card's look, shared by the card in its column and the copy that follows the pointer while dragging. */
export function CardFace({ application, lifted = false }: { application: Application; lifted?: boolean }) {
  const score = application.match_score;
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 text-left text-sm shadow-xs transition-shadow",
        lifted && "rotate-1 shadow-lg ring-2 ring-ring",
      )}
    >
      <div className="font-medium leading-snug">{application.role_title}</div>
      <div className="text-muted-foreground">{application.company.name}</div>
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full", TONE_BAR[matchTone(score)])} style={{ width: `${score ?? 0}%` }} />
        </div>
        <span className="font-mono text-xs text-muted-foreground">{score === null ? "no score" : `${score}%`}</span>
      </div>
      {meta(application) && <div className="mt-1 text-xs text-muted-foreground">{meta(application)}</div>}
    </div>
  );
}

export function SortableCard({
  application,
  disabled,
  onOpen,
}: {
  application: Application;
  disabled: boolean;
  onOpen: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "cursor-grab rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
        isDragging && "opacity-40",
        disabled && "cursor-pointer",
      )}
      {...attributes}
      {...listeners}
      aria-label={`${application.role_title} at ${application.company.name}`}
      // A click that wasn't a drag opens the details (the pointer sensor needs 5px of movement to start a drag).
      onClick={() => onOpen(application.id)}
      // Space picks the card up for keyboard dragging (dnd-kit); Enter opens it instead.
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(application.id);
        else listeners?.onKeyDown?.(event);
      }}
    >
      <CardFace application={application} />
    </div>
  );
}
