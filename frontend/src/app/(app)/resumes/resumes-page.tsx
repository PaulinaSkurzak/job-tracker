"use client";

import { CheckIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/contacts/field";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/dates";
import { fieldErrors } from "@/lib/form-errors";
import { useActivateResume, useDeleteResume, useResumes, useSaveResume, type Resume } from "@/lib/resumes";

function ResumeDialog({ resume, open, onOpenChange }: { resume?: Resume; open: boolean; onOpenChange: (open: boolean) => void }) {
  const save = useSaveResume(resume?.id);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors({});
    try {
      const saved = await save.mutateAsync({ name: String(form.get("name")).trim(), text: String(form.get("text")).trim() });
      toast.success(saved.is_active ? `Saved ${saved.name}. Every application was rescored.` : `Saved ${saved.name}`);
      onOpenChange(false);
    } catch (error) {
      setErrors(fieldErrors(error));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setErrors({});
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{resume ? "Edit resume" : "Add resume"}</DialogTitle>
          <DialogDescription>Paste the plain text of your resume. Formatting doesn&apos;t matter; the skills in it do.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Field id="resume-name" label="Name" error={errors.name}>
            {(props) => <Input {...props} name="name" defaultValue={resume?.name} placeholder="e.g. Data science, Fall 2026" required autoFocus />}
          </Field>
          <Field id="resume-text" label="Resume text" error={errors.text}>
            {(props) => <Textarea {...props} name="text" defaultValue={resume?.text} rows={14} required className="font-mono text-xs" />}
          </Field>
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : resume ? "Save changes" : "Add resume"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResumesPage() {
  const { data, isPending, isError, refetch } = useResumes();
  const activate = useActivateResume();
  const remove = useDeleteResume();
  const [dialog, setDialog] = useState<{ open: boolean; resume?: Resume }>({ open: false });
  const [deleting, setDeleting] = useState<Resume | null>(null);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumes</h1>
          <p className="text-sm text-muted-foreground">Every application is scored against the active one.</p>
        </div>
        <Button onClick={() => setDialog({ open: true })}>
          <PlusIcon /> Add resume
        </Button>
      </div>

      {isError ? (
        <div role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm">
          Could not load your resumes.{" "}
          <button className="underline" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No resumes yet</p>
          <p className="text-sm text-muted-foreground">Add one to get a match score on every application. The first one becomes active.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((resume) => (
            <li key={resume.id}>
              <Card className={resume.is_active ? "ring-2 ring-primary/30" : undefined}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {resume.name}
                    {resume.is_active && <Badge>Active</Badge>}
                  </CardTitle>
                  <CardDescription>Added {formatDateTime(resume.created_at)}</CardDescription>
                  <CardAction className="flex gap-1.5">
                    {!resume.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={activate.isPending}
                        onClick={() =>
                          activate.mutate(resume.id, {
                            onSuccess: () => toast.success(`${resume.name} is now active. Every application was rescored.`),
                            onError: () => toast.error("Could not activate the resume. Try again."),
                          })
                        }
                      >
                        <CheckIcon /> Make active
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setDialog({ open: true, resume })} aria-label={`Edit ${resume.name}`}>
                      <PencilIcon />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleting(resume)} aria-label={`Delete ${resume.name}`}>
                      <Trash2Icon />
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 whitespace-pre-line font-mono text-xs text-muted-foreground">{resume.text}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* key: a fresh form for each resume, since the fields use defaultValue. */}
      <ResumeDialog key={dialog.resume?.id ?? "new"} resume={dialog.resume} open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.is_active
                ? "It's your active resume, so applications will have no match score until you make another one active."
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: () => toast.success(`Deleted ${deleting.name}`),
                  onError: () => toast.error("Could not delete the resume. Try again."),
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
