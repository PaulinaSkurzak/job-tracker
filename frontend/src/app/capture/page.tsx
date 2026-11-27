import type { Metadata } from "next";
import { Suspense } from "react";

import { CapturePage } from "./capture-page";

export const metadata: Metadata = { title: "Save a posting" };

/** Opened by the "Save to Job Tracker" bookmarklet as a small window; outside the sidebar layout on purpose. */
export default function Page() {
  return (
    <Suspense>
      <CapturePage />
    </Suspense>
  );
}
