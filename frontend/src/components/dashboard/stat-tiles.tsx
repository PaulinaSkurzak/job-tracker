import { Card, CardContent } from "@/components/ui/card";
import type { Dashboard } from "@/lib/dashboard";

export function StatTiles({ stats }: { stats: Dashboard["stats"] }) {
  const tiles = [
    { label: "Active applications", value: String(stats.active_applications), note: "Applied, in screening, interviewing or offered" },
    {
      label: "Applied this week",
      value: String(stats.applied_this_week),
      note: stats.applied_this_week >= stats.weekly_goal ? `Goal of ${stats.weekly_goal} reached` : `Goal ${stats.weekly_goal}`,
    },
    {
      label: "Reached interview",
      value: `${stats.reached_interview_percent}%`,
      note: `${stats.reached_interview} of ${stats.applied_total} applied`,
    },
    {
      label: "Average match",
      value: stats.average_match === null ? "–" : `${stats.average_match}%`,
      note: stats.scored_applications ? `${stats.scored_applications} postings scored` : "Add a resume to score postings",
    },
  ];

  return (
    <section aria-label="Key numbers" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="gap-1 py-4">
          <CardContent className="px-5">
            <div className="text-sm text-muted-foreground">{tile.label}</div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums">{tile.value}</div>
            <div className="text-xs text-muted-foreground">{tile.note}</div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
