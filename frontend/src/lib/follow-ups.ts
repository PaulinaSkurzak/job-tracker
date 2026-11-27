"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { api, errorMessage, unwrap, type Schemas } from "@/lib/api/client";
import {
  snoozedDate,
  withFollowUpDate,
  withoutFollowUp,
  type Dashboard,
  type FollowUp,
} from "@/lib/dashboard";
import { formatDay } from "@/lib/dates";

export const DASHBOARD_KEY = ["dashboard"] as const;

export function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: async () => unwrap(await api.GET("/api/dashboard/")),
  });
}

type Patch = Schemas["PatchedInteraction"];
type Variables = { id: number; patch: Patch; previous: Dashboard | undefined; message?: string; undo?: Patch };

/**
 * Done and Snooze on the dashboard. Same pattern as the board: the row changes immediately, the PATCH runs
 * in the background, a failure rolls back with an error toast, and success offers Undo (another PATCH).
 */
export function useFollowUpActions() {
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: async ({ id, patch }: Variables) =>
      unwrap(await api.PATCH("/api/interactions/{id}/", { params: { path: { id } }, body: patch })),
    onError: (error, { previous }) => {
      if (previous) queryClient.setQueryData(DASHBOARD_KEY, previous);
      toast.error(`Could not update the follow-up: ${errorMessage(error)}`);
    },
    onSuccess: (_data, { id, message, undo }) => {
      if (message && undo) {
        toast(message, { action: { label: "Undo", onClick: () => send(id, undo, (data) => data) } });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] }); // the contacts table shows next follow-up
    },
  });

  // Snapshot, apply the optimistic change synchronously, then send (see useMoveApplication for why).
  const send = useCallback(
    (id: number, patch: Patch, change: (data: Dashboard) => Dashboard, message?: string, undo?: Patch) => {
      const previous = queryClient.getQueryData<Dashboard>(DASHBOARD_KEY);
      void queryClient.cancelQueries({ queryKey: DASHBOARD_KEY });
      if (previous) queryClient.setQueryData(DASHBOARD_KEY, change(previous));
      mutate({ id, patch, previous, message, undo });
    },
    [queryClient, mutate],
  );

  const markDone = useCallback(
    (item: FollowUp) =>
      send(item.id, { follow_up_done: true }, (data) => withoutFollowUp(data, item.id), `Marked done: ${item.contact_name}`, {
        follow_up_done: false,
      }),
    [send],
  );

  const snooze = useCallback(
    (item: FollowUp, today: string) => {
      const date = snoozedDate(today);
      send(
        item.id,
        { follow_up_date: date },
        (data) => withFollowUpDate(data, item.id, date),
        `Snoozed ${item.contact_name} to ${formatDay(date)}`,
        { follow_up_date: item.follow_up_date },
      );
    },
    [send],
  );

  return { markDone, snooze };
}
