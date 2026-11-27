"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dueLabel, type FollowUp } from "@/lib/dashboard";
import { formatDay } from "@/lib/dates";
import { useFollowUpActions } from "@/lib/follow-ups";
import { cn } from "@/lib/utils";

export function FollowUpsTable({ followUps, today }: { followUps: FollowUp[]; today: string }) {
  const { markDone, snooze } = useFollowUpActions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Follow-ups <span className="font-normal text-muted-foreground">{followUps.length} open</span>
        </CardTitle>
        <CardDescription>Overdue, and due in the next 14 days</CardDescription>
        <CardAction>
          <Button variant="link" asChild className="px-0">
            <Link href="/contacts">All contacts</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {followUps.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            All caught up. Nothing to follow up on for the next two weeks.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {followUps.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.contact_name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.company_name || "–"}</TableCell>
                  <TableCell className="max-w-80 truncate" title={item.notes}>
                    {item.notes || "Follow up"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      title={formatDay(item.follow_up_date)}
                      className={cn(item.days_until < 0 && "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-300")}
                    >
                      {dueLabel(item.days_until)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => snooze(item, today)} aria-label={`Snooze ${item.contact_name} for 2 days`}>
                      Snooze
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => markDone(item)} aria-label={`Mark ${item.contact_name} done`}>
                      Done
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
