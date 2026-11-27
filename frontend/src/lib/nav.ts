import { FileCheckIcon, KanbanIcon, LayoutDashboardIcon, UsersIcon, type LucideIcon } from "lucide-react";

export type NavItem = { title: string; href: string; icon: LucideIcon };

/** One list drives the sidebar and the ⌘K menu, so they can't drift apart. */
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Board", href: "/board", icon: KanbanIcon },
  { title: "Contacts", href: "/contacts", icon: UsersIcon },
  { title: "Resume match", href: "/match", icon: FileCheckIcon },
];

export function titleFor(pathname: string): string {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.title ?? "";
}
