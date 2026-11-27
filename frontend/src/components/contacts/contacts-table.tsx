"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Contact } from "@/lib/contacts";
import { daysBetween, dueLabel } from "@/lib/dashboard";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

function columns(today: string): ColumnDef<Contact>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          {/* A real link, so the row works with the keyboard, middle-click and "open in new tab". */}
          <Link href={`/contacts/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
          {row.original.role && <div className="text-xs text-muted-foreground">{row.original.role}</div>}
        </div>
      ),
    },
    {
      id: "company",
      accessorFn: (c) => c.company?.name ?? "",
      header: "Company",
      cell: ({ getValue }) => getValue<string>() || <span className="text-muted-foreground">–</span>,
    },
    {
      id: "last_contacted",
      // No date becomes undefined so sortUndefined can keep it last in both directions. (A custom sort function
      // would be reversed for descending order and put "Never" first.) ISO dates sort correctly as text.
      accessorFn: (c) => c.last_contacted ?? undefined,
      header: "Last contacted",
      sortingFn: "text",
      sortUndefined: "last",
      cell: ({ getValue }) => {
        const value = getValue<string | undefined>();
        return value ? formatDay(value) : <span className="text-muted-foreground">Never</span>;
      },
    },
    {
      id: "next_follow_up",
      accessorFn: (c) => c.next_follow_up ?? undefined,
      header: "Next follow-up",
      sortingFn: "text",
      sortUndefined: "last",
      cell: ({ getValue }) => {
        const value = getValue<string | undefined>();
        if (!value) return <span className="text-muted-foreground">None</span>;
        const days = daysBetween(today, value);
        return (
          <Badge
            variant="outline"
            title={formatDay(value)}
            className={cn(days < 0 && "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-300")}
          >
            {dueLabel(days)}
          </Badge>
        );
      },
    },
    {
      id: "applications",
      accessorFn: (c) => c.applications?.length ?? 0,
      header: "Applications",
      cell: ({ getValue }) => <span className="font-mono">{getValue<number>()}</span>,
    },
  ];
}

function SortButton({ label, direction, onClick }: { label: string; direction: false | "asc" | "desc"; onClick?: (event: unknown) => void }) {
  const Icon = direction === "asc" ? ArrowUpIcon : direction === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={onClick}>
      {label}
      <Icon className={cn(!direction && "opacity-40")} />
    </Button>
  );
}

export function ContactsTable({ contacts, today }: { contacts: Contact[]; today: string }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [filter, setFilter] = useState("");

  // The linter notes React Compiler can't auto-memoize TanStack Table. Expected, and harmless: this project
  // doesn't enable React Compiler, and the table is small.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: contacts,
    columns: columns(today),
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    sortDescFirst: false, // first click always sorts ascending (TanStack guesses from the data otherwise)
    onGlobalFilterChange: setFilter,
    // Search by name or company only, not by dates or counts.
    globalFilterFn: (row, _columnId, value: string) =>
      `${row.original.name} ${row.original.company?.name ?? ""}`.toLowerCase().includes(value.toLowerCase().trim()),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        aria-label="Filter by name or company"
        placeholder="Filter by name or company…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        className="h-9 max-w-xs"
      />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    >
                      <SortButton
                        label={String(header.column.columnDef.header)}
                        direction={sorted}
                        onClick={header.column.getToggleSortingHandler()}
                      />
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  {filter ? `No contacts match “${filter}”.` : "No contacts yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.length} of {contacts.length} contact{contacts.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
