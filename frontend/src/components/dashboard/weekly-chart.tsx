"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { weekLabel, type Dashboard } from "@/lib/dashboard";

// Blue, a shade darker in light mode and lighter in dark mode so it keeps its contrast on either background.
const config = {
  count: { label: "Applications", theme: { light: "oklch(0.546 0.245 262.881)", dark: "oklch(0.707 0.165 254.624)" } },
} satisfies ChartConfig;

export function WeeklyChart({ weekly, goal }: { weekly: Dashboard["weekly"]; goal: number }) {
  const data = weekly.map((week) => ({ week: weekLabel(week.week_start), count: week.count }));
  const total = weekly.reduce((sum, week) => sum + week.count, 0);
  const peak = Math.max(goal, ...weekly.map((w) => w.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Applications per week</CardTitle>
        <CardDescription>Last 8 weeks · dashed line is your goal of {goal}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Charts are pictures to a screen reader; this sentence gives the same information. */}
        <p className="sr-only">
          {total} applications in the last 8 weeks, {weekly.at(-1)?.count ?? 0} this week. By week:{" "}
          {data.map((d) => `${d.week}: ${d.count}`).join(", ")}.
        </p>
        <ChartContainer config={config} className="aspect-auto h-52 w-full" aria-hidden="true">
          <AreaChart data={data} margin={{ left: -24, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} domain={[0, peak + 1]} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <ReferenceLine y={goal} stroke="var(--muted-foreground)" strokeDasharray="5 5" />
            <Area dataKey="count" type="monotone" stroke="var(--color-count)" fill="var(--color-count)" fillOpacity={0.18} strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
