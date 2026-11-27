"use client";

import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useApplication } from "@/lib/applications";
import { STATUS_LABELS, type Status } from "@/lib/board";
import { formatDateTime, formatDay } from "@/lib/dates";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

/** Side panel with one application's details and status history. Opens when a card is clicked. */
export function ApplicationSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: application, isPending, isError } = useApplication(id);

  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {isError ? (
          <SheetHeader>
            <SheetTitle>Could not load this application</SheetTitle>
            <SheetDescription>It may have been deleted. Close the panel and refresh the board.</SheetDescription>
          </SheetHeader>
        ) : isPending || !application ? (
          <SheetHeader>
            <SheetTitle>
              <Skeleton className="h-6 w-48" />
            </SheetTitle>
            <SheetDescription asChild>
              <Skeleton className="h-4 w-32" />
            </SheetDescription>
          </SheetHeader>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-lg">{application.role_title}</SheetTitle>
              <SheetDescription>
                {application.company.name}
                {application.location ? ` · ${application.location}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-6">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Status">{application.status_display}</Field>
                <Field label="Resume match">
                  {application.match_score === null ? "Not scored" : `${application.match_score}%`}
                </Field>
                <Field label="Term">
                  {application.term || "Not set"}
                  {application.coop_months ? ` · ${application.coop_months} mo` : ""}
                </Field>
                <Field label={application.date_applied ? "Applied" : "Deadline"}>
                  {application.date_applied
                    ? formatDay(application.date_applied)
                    : application.deadline
                      ? formatDay(application.deadline)
                      : "Not set"}
                </Field>
              </div>

              {application.contacts.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-sm font-medium">Contacts</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {application.contacts.map((contact) => (
                      <li key={contact.id} className="rounded-md bg-muted px-2 py-1 text-sm">
                        {contact.name}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="mb-1.5 text-sm font-medium">History</h3>
                <ol className="flex flex-col">
                  {[...application.status_history].reverse().map((change) => (
                    <li
                      key={change.changed_at + change.to_status}
                      className="flex justify-between gap-3 border-t py-1.5 text-sm"
                    >
                      <span>
                        {change.from_status
                          ? `${STATUS_LABELS[change.from_status as Status] ?? change.from_status} → ${STATUS_LABELS[change.to_status]}`
                          : `Added as ${STATUS_LABELS[change.to_status]}`}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{formatDateTime(change.changed_at)}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="flex flex-wrap gap-2">
                {application.job_url && (
                  <Button variant="outline" asChild>
                    <a href={application.job_url} target="_blank" rel="noopener noreferrer">
                      Job posting <ExternalLinkIcon />
                    </a>
                  </Button>
                )}
                {/* The edit form comes in step 8; until then the classic page handles editing. */}
                <Button variant="outline" asChild>
                  <a href={`/classic/applications/${application.id}/edit/`}>Edit</a>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
