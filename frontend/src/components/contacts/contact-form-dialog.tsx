"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApplications } from "@/lib/applications";
import type { ContactDetail, ContactInput } from "@/lib/contacts";
import { fieldErrors } from "@/lib/form-errors";

import { Field } from "./field";

/** Add or edit a contact. `contact` given means edit. `onSave` returns a promise; its errors show in the form. */
export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: ContactDetail;
  onSave: (input: ContactInput) => Promise<unknown>;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const { data: applications } = useApplications();
  const [linked, setLinked] = useState<number[]>(contact?.applications ?? []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    setPending(true);
    setErrors({});
    try {
      await onSave({
        name: text("name"),
        company_name: text("company_name"), // blank clears it; the API finds or creates the company by name
        role: text("role"),
        email: text("email"),
        linkedin_url: text("linkedin_url"),
        notes: text("notes"),
        applications: linked,
      });
      onOpenChange(false);
    } catch (error) {
      setErrors(fieldErrors(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setLinked(contact?.applications ?? []);
        setErrors({});
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
          <DialogDescription>People you have talked to, or plan to, about a role.</DialogDescription>
        </DialogHeader>
        <form id="contact-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Field id="name" label="Name" error={errors.name}>
            {(props) => <Input {...props} name="name" defaultValue={contact?.name} required autoFocus />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="company_name" label="Company" error={errors.company_name}>
              {(props) => <Input {...props} name="company_name" defaultValue={contact?.company?.name ?? ""} />}
            </Field>
            <Field id="role" label="Role" error={errors.role}>
              {(props) => <Input {...props} name="role" defaultValue={contact?.role} placeholder="e.g. Recruiter" />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="email" label="Email" error={errors.email}>
              {(props) => <Input {...props} name="email" type="email" defaultValue={contact?.email} />}
            </Field>
            <Field id="linkedin_url" label="LinkedIn URL" error={errors.linkedin_url}>
              {(props) => <Input {...props} name="linkedin_url" type="url" defaultValue={contact?.linkedin_url} />}
            </Field>
          </div>
          {applications && applications.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">Helping with</legend>
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-md border p-2">
                {applications.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`app-${a.id}`}
                      checked={linked.includes(a.id)}
                      onCheckedChange={(checked) =>
                        setLinked((ids) => (checked ? [...ids, a.id] : ids.filter((id) => id !== a.id)))
                      }
                    />
                    <Label htmlFor={`app-${a.id}`} className="font-normal">
                      {a.role_title} · {a.company.name}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
          )}
          <Field id="notes" label="Notes" error={errors.notes}>
            {(props) => <Textarea {...props} name="notes" defaultValue={contact?.notes} rows={3} />}
          </Field>
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="contact-form" disabled={pending}>
            {pending ? "Saving…" : contact ? "Save changes" : "Add contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
