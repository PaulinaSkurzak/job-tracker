"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { CommandMenu } from "@/components/command-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/auth";
import { titleFor } from "@/lib/nav";

/**
 * Shell for every logged-in page (the "(app)" folder is a route group: it shares this layout without
 * adding "/app" to the URL). It asks the API who is logged in and sends logged-out visitors to /login.
 *
 * This check is for user experience only. The real protection is on the server: every API endpoint
 * returns 403 without a valid session, so a logged-out visitor sees an empty shell at most, never data.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    if (me.isSuccess && me.data === null) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [me.isSuccess, me.data, pathname, router]);

  if (!me.data) {
    return (
      <div className="flex min-h-svh items-center justify-center" aria-busy="true">
        {me.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not reach the server. Is <code>docker compose up</code> running?
          </p>
        ) : (
          <Skeleton className="h-8 w-48" />
        )}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar user={me.data} onOpenCommand={() => setCommandOpen(true)} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-sm text-muted-foreground">
            Job Tracker <span aria-hidden="true">/</span>{" "}
            <span className="text-foreground">{titleFor(pathname)}</span>
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  );
}
