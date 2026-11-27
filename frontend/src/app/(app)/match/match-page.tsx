"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage, unwrap } from "@/lib/api/client";
import { useApplications, useSaveApplication } from "@/lib/applications";
import { segments } from "@/lib/highlight";
import { useMatch, useResumes } from "@/lib/resumes";
import { cn } from "@/lib/utils";

const PASTE = "paste";

function Chips({ skills, tone }: { skills: string[]; tone: "have" | "missing" }) {
  if (skills.length === 0) return <p className="text-sm text-muted-foreground">None</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <li
          key={skill}
          className={cn(
            "rounded-md px-2 py-0.5 text-sm font-medium",
            tone === "have"
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
          )}
        >
          {skill}
        </li>
      ))}
    </ul>
  );
}

export function MatchPage() {
  const [text, setText] = useState("");
  const [source, setSource] = useState<string>(PASTE); // an application id, or "paste"
  const [loadedText, setLoadedText] = useState(""); // the application's description as loaded, to detect edits
  const { data: applications } = useApplications();
  const { data: resumes } = useResumes();
  const match = useMatch(text);
  const save = useSaveApplication(source === PASTE ? undefined : Number(source));

  const result = match.data;
  const active = result?.results.find((r) => r.is_active) ?? result?.results[0];
  const pieces = useMemo(
    () => (result && active ? segments(result.text, result.spans, new Set(active.matched)) : []),
    [result, active],
  );
  const typing = text.trim() !== (result?.text ?? "") && text.trim().length > 0;

  async function loadApplication(value: string) {
    setSource(value);
    if (value === PASTE) return;
    try {
      // The board list leaves descriptions out to stay small, so fetch this one in full.
      const detail = unwrap(await api.GET("/api/applications/{id}/", { params: { path: { id: Number(value) } } }));
      setText(detail.job_description ?? "");
      setLoadedText(detail.job_description ?? "");
    } catch (error) {
      toast.error(`Could not load the application: ${errorMessage(error)}`);
    }
  }

  if (resumes && resumes.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Resume match</h1>
        <p className="text-muted-foreground">
          Add a resume first, then paste a job description here to see which skills match.{" "}
          <Link href="/resumes" className="underline">
            Go to Resumes
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resume match</h1>
        <p className="text-sm text-muted-foreground">The score updates as you type. Skills are highlighted in the posting.</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Job description</CardTitle>
            <CardDescription>Paste a posting, or load one from an application.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source">Application</Label>
              <Select value={source} onValueChange={loadApplication}>
                <SelectTrigger id="source" className="w-full sm:w-96">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PASTE}>Paste a new posting</SelectItem>
                  {applications?.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.role_title} · {a.company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job-description">Text</Label>
              <Textarea
                id="job-description"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={10}
                placeholder="Paste the job description here…"
              />
            </div>
            {source !== PASTE && text !== loadedText && (
              <div>
                <Button
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate(
                      { job_description: text },
                      {
                        onSuccess: (saved) => {
                          setLoadedText(text);
                          toast.success(`Saved to ${saved.role_title} · ${saved.match_score ?? "no"}% match`);
                        },
                        onError: (error) => toast.error(`Could not save: ${errorMessage(error)}`),
                      },
                    )
                  }
                >
                  Save description to application
                </Button>
              </div>
            )}
            {pieces.length > 0 && (
              <section aria-labelledby="highlighted">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <h2 id="highlighted" className="text-sm font-medium">
                    Highlighted
                  </h2>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-900" /> In your resume
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-2.5 rounded-sm bg-orange-200 dark:bg-orange-900" /> Missing
                    </span>
                  </div>
                </div>
                <p className="whitespace-pre-wrap rounded-lg border p-3 text-sm leading-7">
                  {pieces.map((piece, index) =>
                    piece.kind === "plain" ? (
                      <span key={index}>{piece.text}</span>
                    ) : (
                      // <mark> is announced as highlighted text; the title says which skill it counts as.
                      <mark
                        key={index}
                        title={piece.kind === "have" ? `${piece.skill}: in your resume` : `${piece.skill}: missing`}
                        className={cn(
                          "rounded px-0.5 font-medium",
                          piece.kind === "have"
                            ? "bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100"
                            : "bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100",
                        )}
                      >
                        {piece.text}
                      </mark>
                    ),
                  )}
                </p>
              </section>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card aria-live="polite">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                Match with {active?.resume_name ?? "your active resume"}
                {(match.isFetching || typing) && <Loader2Icon className="size-3.5 animate-spin" aria-label="Updating" />}
              </CardDescription>
              <CardTitle className="text-5xl font-semibold tracking-tight tabular-nums">
                {!active ? "–" : active.score === null ? "–" : `${active.score}%`}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!text.trim() ? (
                <p className="text-sm text-muted-foreground">Paste a job description to see the score.</p>
              ) : match.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Could not score this posting: {errorMessage(match.error)}
                </p>
              ) : active && active.score === null ? (
                <p className="text-sm text-muted-foreground">No skills from the vocabulary found in this posting yet.</p>
              ) : active ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {active.matched.length} of {active.matched.length + active.missing.length} skills in the posting
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full bg-blue-600 dark:bg-blue-400" style={{ width: `${active.score ?? 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <h2 className="mb-1.5 text-sm font-medium">Missing</h2>
                    <Chips skills={active.missing} tone="missing" />
                  </div>
                  <div>
                    <h2 className="mb-1.5 text-sm font-medium">In your resume</h2>
                    <Chips skills={active.matched} tone="have" />
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {result && result.results.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Compare resumes</CardTitle>
                <CardDescription>The same posting scored against each version</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col">
                  {[...result.results]
                    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
                    .map((r) => (
                      <li key={r.resume_id} className="grid grid-cols-[1fr_6rem_3rem] items-center gap-3 border-t py-2 first:border-t-0">
                        <span className="truncate text-sm">
                          {r.resume_name} {r.is_active && <span className="text-xs text-muted-foreground">(active)</span>}
                        </span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span className="block h-full bg-blue-600 dark:bg-blue-400" style={{ width: `${r.score ?? 0}%` }} />
                        </span>
                        <span className="text-right font-mono text-sm">{r.score === null ? "–" : `${r.score}%`}</span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
