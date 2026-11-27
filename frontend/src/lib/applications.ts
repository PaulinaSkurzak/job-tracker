"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { api, errorMessage, unwrap, type Schemas } from "@/lib/api/client";
import { applyMove, STATUS_LABELS, type Application, type Status } from "@/lib/board";

export const APPLICATIONS_KEY = ["applications"] as const;
export const applicationKey = (id: number) => ["application", id] as const;

export function useApplications() {
  return useQuery({
    queryKey: APPLICATIONS_KEY,
    queryFn: async () => unwrap(await api.GET("/api/applications/")),
  });
}

export function useApplication(id: number | null) {
  return useQuery({
    queryKey: applicationKey(id ?? 0),
    queryFn: async () => unwrap(await api.GET("/api/applications/{id}/", { params: { path: { id: id! } } })),
    enabled: id !== null,
  });
}

export type MoveInput = {
  id: number;
  status: Status;
  ids: number[]; // the target column's card ids, top to bottom, after the move
  undo?: { status: Status; ids: number[] }; // where the card was, for the Undo button
};

type MoveVariables = MoveInput & { previous: Application[] | undefined };

/**
 * Drag and drop with an optimistic update: the board changes the moment the card is dropped, and the
 * request runs in the background. If the server rejects the move, the board rolls back and a toast
 * explains why. A move to another column offers Undo, which is just another move back.
 *
 * The snapshot and the optimistic change happen synchronously in moveCard(), not in the mutation's
 * onMutate: onMutate runs a moment later, and in between the card would flash back to its old place.
 */
export function useMoveApplication() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ id, status, ids }: MoveVariables) =>
      unwrap(await api.POST("/api/applications/{id}/move/", { params: { path: { id } }, body: { status, ids } })),

    onError: (error, { previous }) => {
      if (previous) queryClient.setQueryData(APPLICATIONS_KEY, previous);
      toast.error(`Could not move the card: ${errorMessage(error)}`);
    },

    onSuccess: (updated, input) => {
      queryClient.setQueryData(applicationKey(updated.id), updated); // the detail panel shows the new history
      const undo = input.undo;
      if (undo && undo.status !== input.status) {
        toast(`Moved ${updated.role_title} to ${STATUS_LABELS[input.status]}`, {
          action: { label: "Undo", onClick: () => moveCard({ id: input.id, ...undo }) },
        });
      }
    },

    // Either way, refetch so the board matches the server exactly (e.g. positions it normalised).
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] }); // funnel and counts depend on statuses
    },
  });

  const { mutate } = mutation;
  const moveCard = useCallback(
    (input: MoveInput) => {
      const previous = queryClient.getQueryData<Application[]>(APPLICATIONS_KEY);
      // Stop an in-flight refetch from overwriting the optimistic state with older data.
      void queryClient.cancelQueries({ queryKey: APPLICATIONS_KEY });
      if (previous) queryClient.setQueryData(APPLICATIONS_KEY, applyMove(previous, input.id, input.status, input.ids));
      mutate({ ...input, previous });
    },
    [queryClient, mutate],
  );

  return { moveCard, isPending: mutation.isPending };
}

// ---- Create, edit, delete ---------------------------------------------------------------------

export type ApplicationInput = Partial<
  Pick<
    Schemas["ApplicationDetail"],
    | "company_name"
    | "role_title"
    | "location"
    | "job_url"
    | "status"
    | "term"
    | "coop_months"
    | "date_applied"
    | "deadline"
    | "job_description"
  >
>;

export function useCompanies() {
  return useQuery({ queryKey: ["companies"], queryFn: async () => unwrap(await api.GET("/api/companies/")) });
}

/** Saving an application can change its score, status history and company, so refresh what shows them. */
function useRefreshApplications() {
  const queryClient = useQueryClient();
  return (id?: number) => {
    for (const key of [APPLICATIONS_KEY, ["dashboard"], ["companies"], ["contacts"]]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
    if (id !== undefined) void queryClient.invalidateQueries({ queryKey: applicationKey(id) });
  };
}

export function useSaveApplication(id?: number) {
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: async (body: ApplicationInput) =>
      id === undefined
        ? unwrap(await api.POST("/api/applications/", { body: body as Schemas["ApplicationDetail"] }))
        : unwrap(
            await api.PATCH("/api/applications/{id}/", {
              params: { path: { id } },
              body: body as Schemas["PatchedApplicationDetail"],
            }),
          ),
    onSuccess: (saved) => refresh(saved.id),
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.DELETE("/api/applications/{id}/", { params: { path: { id } } })),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: applicationKey(id) });
      refresh();
    },
  });
}
