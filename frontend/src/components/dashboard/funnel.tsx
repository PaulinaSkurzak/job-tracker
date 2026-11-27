import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard } from "@/lib/dashboard";

export function Funnel({ funnel }: { funnel: Dashboard["funnel"] }) {
  const empty = funnel[0]?.count === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline funnel</CardTitle>
        <CardDescription>Applications that ever reached each stage, from status history</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground">Move a card to Applied on the board and the funnel starts filling in.</p>
        ) : (
          <dl className="flex flex-col gap-3.5">
            {funnel.map((stage) => (
              <div key={stage.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <dt>{stage.label}</dt>
                  <dd className="font-mono text-muted-foreground">
                    {stage.count} · {stage.percent}%
                  </dd>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${stage.percent}%` }} />
                </div>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
