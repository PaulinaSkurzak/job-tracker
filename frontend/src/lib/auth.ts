"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api, unwrap, type Schemas } from "@/lib/api/client";

export const ME_KEY = ["me"] as const;

/** The logged-in user, or null when logged out. Asked once and cached; used to guard every page. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<Schemas["User"] | null> => {
      try {
        return unwrap(await api.GET("/api/auth/me/"));
      } catch (error) {
        // Django returns 403 for a missing session; that just means "logged out".
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
        throw error;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
}

export async function login(username: string, password: string): Promise<Schemas["User"]> {
  await api.GET("/api/auth/csrf/"); // make sure the csrftoken cookie exists before the POST
  return unwrap(await api.POST("/api/auth/login/", { body: { username, password } }));
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/auth/logout/")),
    onSuccess: () => {
      queryClient.clear(); // drop every cached response from the previous session
      queryClient.setQueryData(ME_KEY, null);
    },
  });
}
