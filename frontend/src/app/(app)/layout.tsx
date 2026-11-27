import { Suspense } from "react";

import { AppShell, ShellLoading } from "./app-shell";

/**
 * Layout for every logged-in page. The "(app)" folder is a route group: its pages share this layout
 * without "/app" appearing in the URL.
 *
 * The shell reads the current URL (to highlight the sidebar link and to send logged-out visitors to
 * /login?next=...). With Cache Components on, Next.js requires anything that reads the URL to sit
 * inside a Suspense boundary, so pages like /contacts/[id] can still be partly prerendered.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellLoading />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
