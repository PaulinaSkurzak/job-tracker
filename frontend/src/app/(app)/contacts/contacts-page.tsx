"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useContacts, useCreateContact } from "@/lib/contacts";
import { todayLocal } from "@/lib/dates";
import { useDashboard } from "@/lib/follow-ups";

export function ContactsPage() {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useContacts();
  // The dashboard knows the server's "today", which the follow-up badges are relative to.
  const today = useDashboard().data?.today ?? todayLocal();
  const create = useCreateContact();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">People who can help with your applications</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <PlusIcon /> Add contact
        </Button>
      </div>

      {isError ? (
        <div role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm">
          Could not load your contacts.{" "}
          <button className="underline" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : isPending ? (
        <Skeleton className="h-64 rounded-lg" aria-label="Loading contacts" />
      ) : (
        <ContactsTable contacts={data} today={today} />
      )}

      <ContactFormDialog
        open={adding}
        onOpenChange={setAdding}
        onSave={async (input) => {
          const contact = await create.mutateAsync(input);
          router.push(`/contacts/${contact.id}`);
        }}
      />
    </div>
  );
}
