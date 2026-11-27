"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/contacts/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApplication, useCompanies, useSaveApplication, type ApplicationInput } from "@/lib/applications";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/board";
import { fieldErrors } from "@/lib/form-errors";

type CoopMonths = 4 | 6 | 8;
const NO_LENGTH = "none"; // Radix Select can't use "" as an item value

/** New application (id undefined) or edit one. Loads the full application (with its description) to edit. */
export function ApplicationFormDialog({ id, open, onOpenChange }: { id?: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const editing = id !== undefined;
  const { data: application, isPending } = useApplication(editing && open ? id : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit application" : "New application"}</DialogTitle>
          <DialogDescription>Paste the job description to get a resume match score.</DialogDescription>
        </DialogHeader>
        {editing && isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          // key: start the form fresh for each application (its fields use defaultValue).
          <ApplicationForm key={application?.id ?? "new"} id={id} application={editing ? application : undefined} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Prefilled values for a new application, e.g. from the browser bookmarklet (see /capture). */
export type ApplicationPrefill = Pick<ApplicationInput, "role_title" | "job_url" | "job_description">;

export function ApplicationForm({
  id,
  application,
  initial,
  onDone,
  onSaved,
}: {
  id?: number;
  application?: ReturnType<typeof useApplication>["data"];
  initial?: ApplicationPrefill;
  onDone: () => void;
  onSaved?: (saved: { id: number; role_title: string; match_score: number | null }) => void;
}) {
  const save = useSaveApplication(id);
  const { data: companies } = useCompanies();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>(application?.status ?? "saved");
  const [months, setMonths] = useState<string>(application?.coop_months ? String(application.coop_months) : NO_LENGTH);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const date = (name: string) => text(name) || null; // an empty date input means "not set"
    const body: ApplicationInput = {
      company_name: text("company_name"),
      role_title: text("role_title"),
      location: text("location"),
      job_url: text("job_url"),
      status,
      term: text("term"),
      coop_months: months === NO_LENGTH ? null : (Number(months) as CoopMonths),
      date_applied: date("date_applied"),
      deadline: date("deadline"),
      job_description: text("job_description"),
    };
    setErrors({});
    try {
      const saved = await save.mutateAsync(body);
      toast.success(
        `${id === undefined ? "Added" : "Saved"} ${saved.role_title}` +
          (saved.match_score === null ? "" : ` · ${saved.match_score}% resume match`),
      );
      onSaved?.(saved);
      onDone();
    } catch (error) {
      setErrors(fieldErrors(error));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company_name" label="Company" error={errors.company_name}>
          {(props) => (
            <>
              <Input {...props} name="company_name" list="company-options" defaultValue={application?.company.name} required autoFocus />
              {/* Suggests companies you already have, so "Bluefin" and "Bluefin Genomics" don't both get created. */}
              <datalist id="company-options">
                {companies?.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </>
          )}
        </Field>
        <Field id="role_title" label="Role" error={errors.role_title}>
          {(props) => <Input {...props} name="role_title" defaultValue={application?.role_title ?? initial?.role_title} placeholder="e.g. Data Science Co-op" required />}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="status" label="Status" error={errors.status}>
          {(props) => (
            <Select value={status} onValueChange={(value) => setStatus(value as Status)}>
              <SelectTrigger {...props} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field id="term" label="Term" error={errors.term}>
          {(props) => <Input {...props} name="term" defaultValue={application?.term ?? "Summer 2027"} />}
        </Field>
        <Field id="coop_months" label="Length" error={errors.coop_months}>
          {(props) => (
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger {...props} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LENGTH}>Not set</SelectItem>
                <SelectItem value="4">4 months</SelectItem>
                <SelectItem value="6">6 months</SelectItem>
                <SelectItem value="8">8 months</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="date_applied" label="Date applied" error={errors.date_applied}>
          {(props) => <Input {...props} name="date_applied" type="date" defaultValue={application?.date_applied ?? ""} />}
        </Field>
        <Field id="deadline" label="Deadline" error={errors.deadline}>
          {(props) => <Input {...props} name="deadline" type="date" defaultValue={application?.deadline ?? ""} />}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="location" label="Location" error={errors.location}>
          {(props) => <Input {...props} name="location" defaultValue={application?.location} placeholder="e.g. Boston, MA" />}
        </Field>
        <Field id="job_url" label="Job posting URL" error={errors.job_url}>
          {(props) => <Input {...props} name="job_url" type="url" defaultValue={application?.job_url ?? initial?.job_url} />}
        </Field>
      </div>

      <Field id="job_description" label="Job description" error={errors.job_description} hint="Used for the resume match score.">
        {(props) => <Textarea {...props} name="job_description" defaultValue={application?.job_description ?? initial?.job_description} rows={8} />}
      </Field>

      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : id === undefined ? "Add application" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
