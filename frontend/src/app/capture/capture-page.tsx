"use client";

import { BookmarkIcon, CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ApplicationForm } from "@/components/applications/application-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/auth";
import { bookmarkletCode, parseCapture, READY, roleFromTitle, type Capture } from "@/lib/capture";
import { useMatch } from "@/lib/resumes";

/** The draggable "Save to Job Tracker" button. React refuses javascript: links in JSX (a safety default), so the
 * href is set on the element directly; this one is our own code, not user input. */
function BookmarkletLink() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", bookmarkletCode(window.location.origin));
  }, []);
  return (
    <a
      ref={ref}
      onClick={(event) => event.preventDefault()} // clicking it here does nothing; it's meant to be dragged
      className="inline-flex cursor-grab items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground shadow-sm"
    >
      <BookmarkIcon className="size-4" /> Save to Job Tracker
    </a>
  );
}

function Instructions() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Save postings from any job site</CardTitle>
        <CardDescription>A bookmark that sends the posting you&apos;re reading to Job Tracker.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
          <li>Show your bookmarks bar (in Chrome: ⌘⇧B).</li>
          <li>Drag this button onto the bookmarks bar:</li>
        </ol>
        <div className="pl-5">
          <BookmarkletLink />
        </div>
        <ol start={3} className="flex list-decimal flex-col gap-2 pl-5 text-sm">
          <li>
            On a job posting, <strong>select the job description</strong> (or select nothing to capture the whole
            page) and click the bookmark.
          </li>
          <li>A small Job Tracker window opens with the posting filled in. Add the company, check it, and save.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Nothing is saved until you click Add. If your browser blocks the window, allow pop-ups for that job site.
        </p>
        <Button variant="outline" asChild className="self-start">
          <Link href="/board">Back to the board</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CaptureForm({ capture }: { capture: Capture }) {
  const match = useMatch(capture.text);
  const active = match.data?.results.find((r) => r.is_active) ?? match.data?.results[0];
  const [saved, setSaved] = useState<{ role_title: string; match_score: number | null } | null>(null);

  if (saved) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2Icon className="size-5 text-emerald-600" /> Added {saved.role_title}
          </CardTitle>
          <CardDescription>
            {saved.match_score === null ? "Saved to your board as Saved." : `Saved to your board · ${saved.match_score}% resume match.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => window.close()}>Close window</Button>
          <Button variant="outline" asChild>
            <Link href="/board">Open the board</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Save this posting</CardTitle>
        <CardDescription>
          {active?.score != null
            ? `${active.score}% match with ${active.resume_name}. Missing: ${active.missing.join(", ") || "nothing"}.`
            : "Add the company, check the details, and save."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ApplicationForm
          initial={{ role_title: roleFromTitle(capture.title), job_url: capture.url, job_description: capture.text }}
          onSaved={setSaved}
          onDone={() => {}}
        />
      </CardContent>
    </Card>
  );
}

export function CapturePage() {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [manual, setManual] = useState(false);
  // Opened by the bookmarklet? Then the job page is window.opener. null while rendering on the server.
  const hasOpener = useSyncExternalStore(
    () => () => {},
    () => Boolean(window.opener),
    () => null,
  );

  useEffect(() => {
    if (me.isSuccess && me.data === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [me.isSuccess, me.data, pathname, router]);

  useEffect(() => {
    if (!me.data) return; // wait until logged in, so the form can actually save
    const opener = window.opener as Window | null;
    if (!opener) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== opener) return; // only the window that opened us
      const parsed = parseCapture(event.data);
      if (parsed) setCapture(parsed);
    };
    window.addEventListener("message", onMessage);
    // Tell the job page we're ready. "*" because we can't know its origin; this ping carries no data.
    opener.postMessage(READY, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [me.data]);

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-4 p-4 md:p-6">
      <div className="text-sm font-semibold">Job Tracker</div>
      {!me.data || hasOpener === null ? (
        <Skeleton className="h-64 rounded-xl" aria-label="Loading" />
      ) : capture ? (
        <CaptureForm capture={capture} />
      ) : manual ? (
        <CaptureForm capture={{ url: "", title: "", text: "" }} />
      ) : hasOpener ? (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for the job page…</CardTitle>
            <CardDescription>If nothing appears in a few seconds, the page may have been closed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setManual(true)}>
              Fill in by hand instead
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Instructions />
      )}
    </main>
  );
}
