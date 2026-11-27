"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ApplicationSheet } from "@/components/board/application-sheet";
import { FollowUpsTable } from "@/components/dashboard/follow-ups-table";
import { Funnel } from "@/components/dashboard/funnel";
import { Deadlines, GoneQuiet } from "@/components/dashboard/side-lists";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { todoLine } from "@/lib/dashboard";
import { parseDay } from "@/lib/dates";
import { useDashboard } from "@/lib/follow-ups";

export function DashboardPage() {
  const { data, isPending, isError, refetch } = useDashboard();
  const [openId, setOpenId] = useState<number | null>(null);

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm">
        Could not load the dashboard.{" "}
        <button className="underline" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading dashboard">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {/* "today" comes from the server, so it is Boston's date even if this laptop's clock is elsewhere. */}
            {parseDay(data.today).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} ·{" "}
            {todoLine(data.follow_ups)}
          </p>
        </div>
        <Button asChild>
          <a href="/classic/applications/new/">
            <PlusIcon /> New application
          </a>
        </Button>
      </div>

      <StatTiles stats={data.stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyChart weekly={data.weekly} goal={data.stats.weekly_goal} />
        <Funnel funnel={data.funnel} />
      </div>

      <FollowUpsTable followUps={data.follow_ups} today={data.today} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Deadlines deadlines={data.deadlines} onOpen={setOpenId} />
        <GoneQuiet quiet={data.gone_quiet} onOpen={setOpenId} />
      </div>

      <ApplicationSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
