"use client";

import { ArrowLeftIcon, MailIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { InteractionTimeline } from "@/components/contacts/interaction-timeline";
import { LogInteractionForm } from "@/components/contacts/log-interaction-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { useApplications } from "@/lib/applications";
import { STATUS_LABELS, statusOf } from "@/lib/board";
import { useContact, useDeleteContact, useUpdateContact } from "@/lib/contacts";
import { todayLocal } from "@/lib/dates";
import { useDashboard } from "@/lib/follow-ups";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export function ContactDetailPage({ id }: { id: number }) {
  const router = useRouter();
  const { data: contact, isPending, error } = useContact(id);
  const { data: applications } = useApplications();
  const today = useDashboard().data?.today ?? todayLocal();
  const update = useUpdateContact(id);
  const remove = useDeleteContact(id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">{missing ? "This contact doesn't exist (it may have been deleted)." : "Could not load this contact."}</p>
        <Button variant="outline" asChild>
          <Link href="/contacts">Back to contacts</Link>
        </Button>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading contact">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  const linked = (applications ?? []).filter((a) => contact.applications?.includes(a.id));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="-ml-2 self-start" asChild>
        <Link href="/contacts">
          <ArrowLeftIcon /> Contacts
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="text-lg">{initials(contact.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{contact.name}</h1>
          <p className="text-muted-foreground">
            {[contact.role, contact.company?.name].filter(Boolean).join(" · ") || "No role or company yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {contact.email && (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${contact.email}`}>
                <MailIcon /> Email
              </a>
            </Button>
          )}
          {contact.linkedin_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${contact.name}`}>
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {contact.notes && <p className="whitespace-pre-line text-sm">{contact.notes}</p>}

      <section aria-labelledby="helping-with">
        <h2 id="helping-with" className="mb-2 text-sm font-medium">
          Helping with
        </h2>
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not linked to an application. Use Edit to link one.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {linked.map((a) => (
              <li key={a.id} className="rounded-md bg-muted px-2.5 py-1.5 text-sm">
                {a.role_title} · {a.company.name} <span className="font-medium">· {STATUS_LABELS[statusOf(a)]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="interactions" className="flex flex-col gap-4">
        <h2 id="interactions" className="text-sm font-medium">
          Interactions <span className="font-normal text-muted-foreground">{contact.interactions.length}</span>
        </h2>
        <LogInteractionForm contactId={id} />
        <InteractionTimeline contactId={id} interactions={contact.interactions} today={today} />
      </section>

      <ContactFormDialog open={editing} onOpenChange={setEditing} contact={contact} onSave={(input) => update.mutateAsync(input)} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {contact.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This also deletes their {contact.interactions.length} interaction
              {contact.interactions.length === 1 ? "" : "s"}. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(`Deleted ${contact.name}`);
                    router.push("/contacts");
                  },
                  onError: () => toast.error("Could not delete the contact. Try again."),
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
