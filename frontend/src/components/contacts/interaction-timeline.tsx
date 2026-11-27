"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSetFollowUpDone, type Interaction } from "@/lib/contacts";
import { daysBetween, dueLabel } from "@/lib/dashboard";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function InteractionTimeline({
  contactId,
  interactions,
  today,
}: {
  contactId: number;
  interactions: Interaction[];
  today: string;
}) {
  const setDone = useSetFollowUpDone(contactId);

  if (interactions.length === 0) {
    return <p className="text-sm text-muted-foreground">No interactions yet. Log the first one above.</p>;
  }

  return (
    // Newest first; the API already orders them that way.
    <ol className="flex flex-col">
      {interactions.map((interaction, index) => {
        const followUp = interaction.follow_up_date;
        const days = followUp ? daysBetween(today, followUp) : 0;
        const late = followUp && !interaction.follow_up_done && days < 0;
        return (
          <li key={interaction.id} className="grid grid-cols-[5rem_1rem_1fr] gap-3">
            <time dateTime={interaction.date} className="pt-0.5 text-sm text-muted-foreground">
              {formatDay(interaction.date)}
            </time>
            <span aria-hidden="true" className="flex flex-col items-center">
              <span className="mt-1.5 size-2.5 rounded-full bg-primary" />
              {index < interactions.length - 1 && <span className="w-px flex-1 bg-border" />}
            </span>
            <div className="pb-5">
              <div className="font-medium">{interaction.kind_display}</div>
              {interaction.notes && <p className="text-sm text-muted-foreground">{interaction.notes}</p>}
              {followUp && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      late && "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-300",
                      interaction.follow_up_done && "text-muted-foreground line-through",
                    )}
                  >
                    Follow up {formatDay(followUp)}
                    {!interaction.follow_up_done && ` · ${dueLabel(days)}`}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    disabled={setDone.isPending}
                    onClick={() => setDone.mutate({ id: interaction.id, done: !interaction.follow_up_done })}
                  >
                    {interaction.follow_up_done ? "Reopen" : "Mark done"}
                  </Button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
