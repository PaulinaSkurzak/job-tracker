"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KIND_LABELS, useLogInteraction, type Interaction } from "@/lib/contacts";
import { todayLocal } from "@/lib/dates";
import { fieldErrors } from "@/lib/form-errors";

import { Field } from "./field";

type Kind = NonNullable<Interaction["kind"]>;

export function LogInteractionForm({ contactId }: { contactId: number }) {
  const log = useLogInteraction(contactId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<Kind>("email");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const followUp = String(form.get("follow_up_date") ?? "");
    setErrors({});
    try {
      await log.mutateAsync({
        date: String(form.get("date")),
        kind,
        notes: String(form.get("notes") ?? "").trim(),
        follow_up_date: followUp || null, // empty means "no follow-up", which the API wants as null
      });
      formRef.current?.reset();
      setKind("email");
      toast.success("Interaction logged");
    } catch (error) {
      setErrors(fieldErrors(error));
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-4" aria-label="Log an interaction" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="kind" label="Kind" error={errors.kind}>
          {(props) => (
            <Select value={kind} onValueChange={(value) => setKind(value as Kind)}>
              <SelectTrigger {...props} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field id="date" label="Date" error={errors.date}>
          {(props) => <Input {...props} name="date" type="date" defaultValue={todayLocal()} required />}
        </Field>
        <Field id="follow_up_date" label="Follow up on" error={errors.follow_up_date} hint="Optional">
          {(props) => <Input {...props} name="follow_up_date" type="date" />}
        </Field>
      </div>
      <Field id="notes" label="Notes" error={errors.notes}>
        {(props) => <Textarea {...props} name="notes" rows={2} placeholder="What did you talk about? What's next?" />}
      </Field>
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <div>
        <Button type="submit" disabled={log.isPending}>
          {log.isPending ? "Saving…" : "Log interaction"}
        </Button>
      </div>
    </form>
  );
}
