"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "@/lib/api/client";

export type Contact = Schemas["Contact"];
export type ContactDetail = Schemas["ContactDetail"];
export type Interaction = Schemas["Interaction"];
/** What a form can send. (The generated Patched type wrongly requires server-computed fields like interaction_count.) */
export type ContactInput = Partial<
  Pick<Schemas["ContactDetail"], "name" | "company_name" | "role" | "email" | "linkedin_url" | "notes" | "applications">
>;
export type InteractionInput = Omit<Schemas["Interaction"], "id" | "contact" | "kind_display">;

export const CONTACTS_KEY = ["contacts"] as const;
export const contactKey = (id: number) => ["contact", id] as const;

export const KIND_LABELS: Record<Schemas["KindEnum"], string> = {
  coffee_chat: "Coffee chat",
  email: "Email",
  referral: "Referral",
  other: "Other",
};

export function useContacts() {
  return useQuery({ queryKey: CONTACTS_KEY, queryFn: async () => unwrap(await api.GET("/api/contacts/")) });
}

export function useContact(id: number) {
  return useQuery({
    queryKey: contactKey(id),
    queryFn: async () => unwrap(await api.GET("/api/contacts/{id}/", { params: { path: { id } } })),
  });
}

/** After any contact change: the list, that contact, and the dashboard's follow-ups may all be stale. */
function useRefresh() {
  const queryClient = useQueryClient();
  return (id?: number) => {
    void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    if (id !== undefined) void queryClient.invalidateQueries({ queryKey: contactKey(id) });
  };
}

export function useCreateContact() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (body: ContactInput) =>
      unwrap(await api.POST("/api/contacts/", { body: body as Schemas["ContactDetail"] })),
    onSuccess: () => refresh(),
  });
}

export function useUpdateContact(id: number) {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (body: ContactInput) =>
      unwrap(await api.PATCH("/api/contacts/{id}/", { params: { path: { id } }, body: body as Schemas["PatchedContactDetail"] })),
    onSuccess: (contact) => {
      queryClient.setQueryData(contactKey(id), contact);
      refresh(id);
    },
  });
}

export function useDeleteContact(id: number) {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async () => unwrap(await api.DELETE("/api/contacts/{id}/", { params: { path: { id } } })),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: contactKey(id) });
      refresh();
    },
  });
}

export function useLogInteraction(contactId: number) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (body: InteractionInput) =>
      unwrap(
        await api.POST("/api/contacts/{id}/interactions/", {
          params: { path: { id: contactId } },
          body: body as Schemas["Interaction"],
        }),
      ),
    onSuccess: () => refresh(contactId),
  });
}

export function useSetFollowUpDone(contactId: number) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) =>
      unwrap(await api.PATCH("/api/interactions/{id}/", { params: { path: { id } }, body: { follow_up_done: done } })),
    onSuccess: () => refresh(contactId),
  });
}
