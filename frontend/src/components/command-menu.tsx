"use client";

import { BookmarkIcon, BriefcaseIcon, MonitorIcon, MoonIcon, PlusIcon, SunIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { useApplicationDialog } from "@/components/applications/application-dialog-context";
import { ApplicationSheet } from "@/components/board/application-sheet";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useApplications } from "@/lib/applications";
import { STATUS_LABELS, statusOf } from "@/lib/board";
import { useContacts } from "@/lib/contacts";
import { NAV_ITEMS } from "@/lib/nav";

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { openNew } = useApplicationDialog();
  // The menu works on every page, so it opens an application's detail panel itself instead of going to the board.
  const [openApplicationId, setOpenApplicationId] = useState<number | null>(null);

  // ⌘K on Mac, Ctrl+K elsewhere, from anywhere in the app.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <>
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Find an application or contact, jump to a page, or run a command"
    >
      {/* CommandDialog is only the pop-up. The search itself (typing, filtering, arrow keys) lives in <Command>,
          and every Command* part below needs to be inside it, or opening the menu crashes. */}
      <Command>
      <CommandInput placeholder="Search applications, contacts, pages…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <RecordResults
          onOpenApplication={(id) => run(() => setOpenApplicationId(id))}
          onOpenContact={(id) => run(() => router.push(`/contacts/${id}`))}
        />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(openNew)}>
            <PlusIcon /> New application
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/capture"))}>
            <BookmarkIcon /> Save postings from your browser
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
              <item.icon /> {item.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <SunIcon /> Light
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <MoonIcon /> Dark
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}>
            <MonitorIcon /> System
          </CommandItem>
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
    <ApplicationSheet id={openApplicationId} onClose={() => setOpenApplicationId(null)} />
    </>
  );
}

/**
 * Applications and contacts as search results. This lives inside the dialog, which only mounts while the menu
 * is open, so the lists are fetched (or read from the cache) when the menu opens, not on every page load.
 *
 * cmdk filters items by their `value`, so each one includes every word worth matching: role, company and
 * status for an application; name, company and role for a contact.
 */
function RecordResults({
  onOpenApplication,
  onOpenContact,
}: {
  onOpenApplication: (id: number) => void;
  onOpenContact: (id: number) => void;
}) {
  const applications = useApplications().data ?? [];
  const contacts = useContacts().data ?? [];

  return (
    <>
      {applications.length > 0 && (
        <CommandGroup heading="Applications">
          {applications.map((a) => {
            const status = STATUS_LABELS[statusOf(a)];
            return (
              <CommandItem
                key={a.id}
                // The id keeps two identical role/company pairs from being treated as one item.
                value={`application-${a.id} ${a.role_title} ${a.company.name} ${status}`}
                onSelect={() => onOpenApplication(a.id)}
              >
                <BriefcaseIcon />
                <span className="truncate">
                  {a.role_title} <span className="text-muted-foreground">· {a.company.name}</span>
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{status}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}
      {contacts.length > 0 && (
        <CommandGroup heading="Contacts">
          {contacts.map((c) => {
            const company = c.company?.name ?? c.company_name ?? "";
            return (
              <CommandItem
                key={c.id}
                value={`contact-${c.id} ${c.name} ${company} ${c.role ?? ""}`}
                onSelect={() => onOpenContact(c.id)}
              >
                <UserIcon />
                <span className="truncate">
                  {c.name} {company && <span className="text-muted-foreground">· {company}</span>}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}
    </>
  );
}
