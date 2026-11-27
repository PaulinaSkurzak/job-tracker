"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Board } from "@/components/board/board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApplications } from "@/lib/applications";
import { STATUSES } from "@/lib/board";

export function BoardPage() {
  const { data, isPending, isError, refetch } = useApplications();
  const [query, setQuery] = useState("");
  // Typing stays responsive even with many cards: filtering re-renders at a lower priority.
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const visible = (data ?? []).filter(
    (a) => !deferredQuery || `${a.role_title} ${a.company.name}`.toLowerCase().includes(deferredQuery),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.length} application${data.length === 1 ? "" : "s"} · ` : ""}
            {query ? "Clear the search to drag cards" : "Drag a card to change its status"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search company or role"
              placeholder="Search company or role"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-56 pl-8"
            />
          </div>
          {/* The new-application form comes in step 8; until then the classic page handles it. */}
          <Button asChild>
            <a href="/classic/applications/new/">
              <PlusIcon /> New application
            </a>
          </Button>
        </div>
      </div>

      {isError ? (
        <div role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm">
          Could not load your applications.{" "}
          <button className="underline" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : isPending ? (
        <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Loading board">
          {STATUSES.map((status) => (
            <Skeleton key={status} className="h-64 w-64 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No applications yet</p>
          <p className="text-sm text-muted-foreground">Add the first role you are interested in to start your board.</p>
        </div>
      ) : (
        <Board applications={visible} filtered={Boolean(deferredQuery)} />
      )}
    </div>
  );
}
