"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, unwrap, type Schemas } from "@/lib/api/client";

export type Resume = Schemas["Resume"];
export type ResumeInput = Pick<Resume, "name" | "text">;

export const RESUMES_KEY = ["resumes"] as const;

export function useResumes() {
  return useQuery({ queryKey: RESUMES_KEY, queryFn: async () => unwrap(await api.GET("/api/resumes/")) });
}

/** Resume changes rescore every application, so everything that shows a score is stale afterwards. */
function useRefreshScores() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [RESUMES_KEY, ["applications"], ["application"], ["dashboard"], ["match"]]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

export function useSaveResume(id?: number) {
  const refresh = useRefreshScores();
  return useMutation({
    mutationFn: async (body: ResumeInput) =>
      id === undefined
        ? unwrap(await api.POST("/api/resumes/", { body: body as Resume }))
        : unwrap(await api.PATCH("/api/resumes/{id}/", { params: { path: { id } }, body })),
    onSuccess: refresh,
  });
}

export function useActivateResume() {
  const refresh = useRefreshScores();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.POST("/api/resumes/{id}/activate/", { params: { path: { id } } })),
    onSuccess: refresh,
  });
}

export function useDeleteResume() {
  const refresh = useRefreshScores();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.DELETE("/api/resumes/{id}/", { params: { path: { id } } })),
    onSuccess: refresh,
  });
}

/** The value, but only after it has stopped changing for `delay` ms (so we don't call the API per keystroke). */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Live scoring. Runs once typing pauses; while a new result loads, the previous one stays on screen
 * (keepPreviousData) instead of flashing empty. Superseded requests are cancelled via the abort signal.
 */
export function useMatch(jobDescription: string) {
  const text = useDebounced(jobDescription.trim());
  return useQuery({
    queryKey: ["match", text],
    // Keep the exact text with its result: spans are positions in *that* text, and while the next result
    // loads, the previous one is still shown, so it must be drawn over the text it was computed from.
    queryFn: async ({ signal }) => ({
      ...unwrap(await api.POST("/api/match/", { body: { job_description: text }, signal })),
      text,
    }),
    enabled: text.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000, // same text, same answer (until a resume changes, which invalidates "match")
  });
}
