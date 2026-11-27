"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/board";
import type { Dashboard } from "@/lib/dashboard";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

function Row({ title, detail, aside, asideClassName, onOpen }: {
  title: string;
  detail: string;
  aside: string;
  asideClassName?: string;
  onOpen: () => void;
}) {
  return (
    <li className="border-t first:border-t-0">
      <button onClick={onOpen} className="flex w-full items-center justify-between gap-3 rounded-md py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-sm text-muted-foreground">{detail}</span>
        </span>
        <span className={cn("shrink-0 font-mono text-sm text-muted-foreground", asideClassName)}>{aside}</span>
      </button>
    </li>
  );
}

export function Deadlines({ deadlines, onOpen }: { deadlines: Dashboard["deadlines"]; onOpen: (id: number) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved roles closing soon</CardTitle>
        <CardDescription>Deadline in the next 14 days, not applied to yet</CardDescription>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deadlines in the next two weeks.</p>
        ) : (
          <ul>
            {deadlines.map((d) => (
              <Row
                key={d.id}
                title={d.role_title}
                detail={`${d.company_name}${d.match_score === null ? "" : ` · ${d.match_score}% match`}`}
                aside={d.days_until === 0 ? "Today" : `${formatDay(d.deadline)} · ${d.days_until}d`}
                // A week or less left: highlight it.
                asideClassName={d.days_until <= 7 ? "font-semibold text-orange-700 dark:text-orange-300" : undefined}
                onOpen={() => onOpen(d.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function GoneQuiet({ quiet, onOpen }: { quiet: Dashboard["gone_quiet"]; onOpen: (id: number) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gone quiet</CardTitle>
        <CardDescription>Applied or in screening, no status change for 14+ days</CardDescription>
      </CardHeader>
      <CardContent>
        {quiet.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has gone quiet. Every application moved in the last two weeks.</p>
        ) : (
          <ul>
            {quiet.map((q) => (
              <Row
                key={q.id}
                title={q.role_title}
                detail={`${q.company_name} · ${STATUS_LABELS[q.status]}${q.date_applied ? ` · applied ${formatDay(q.date_applied)}` : ""}`}
                aside={`${q.days_quiet} days`}
                onOpen={() => onOpen(q.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
