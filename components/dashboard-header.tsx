"use client";

import { useEffect, useState } from "react";
import { Bell, Search, MapPin, Check, X, CheckCheck } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Branch } from "@/lib/types";
import { knownBranchNameFromCode } from "@/lib/branch-scope";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";

interface Notification {
 id: string;
 title: string;
 message: string;
 time: string;
 dotClass: string;
 read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
 {
 id: "1",
 title: "New loan application",
 message: "Charles Mwenda submitted a TZS 5,000,000 loan application",
 time: "2 hours ago",
 dotClass: "bg-info",
 read: false,
 },
 {
 id: "2",
 title: "Payment received",
 message: "Emmanuel Mwakyusa paid TZS 793,334 via M-Pesa",
 time: "5 hours ago",
 dotClass: "bg-success",
 read: false,
 },
 {
 id: "3",
 title: "Loan overdue alert",
 message: "Robert Mtei\u2019s loan is now 35 days overdue",
 time: "1 day ago",
 dotClass: "bg-destructive",
 read: false,
 },
];

interface DashboardHeaderProps {
 title: string;
 description?: string;
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
 const { user } = useSessionUser();
 const [branches, setBranches] = useState<Branch[]>([]);
 const needsBranchLookup = user?.role === "super_admin";

 useEffect(() => {
 if (!needsBranchLookup) return;
 let cancelled = false;
 void fetch("/api/falco/branches", { credentials: "include" })
 .then((r) => {
 if (!r.ok) return null;
 return r.json() as Promise<{ branches?: Branch[] }>;
 })
 .then((d) => {
 if (!cancelled && d) setBranches(d.branches ?? []);
 })
 .catch(() => {});
 return () => {
 cancelled = true;
 };
 }, [needsBranchLookup]);

 const currentBranch = branches.find((b) => b.id === user?.branch_id);
 const branchBadgeLabel =
 currentBranch?.name ??
 (user?.branch_name?.trim() ? user.branch_name.trim() : undefined) ??
 (user?.branch_id?.trim() ? knownBranchNameFromCode(user.branch_id.trim()) ?? undefined : undefined) ??
 (user?.branch_id?.trim() ? `Branch ${user.branch_id.trim()}` : undefined);
 const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
 const unreadCount = notifications.filter((n) => !n.read).length;

 const markAsRead = (id: string) =>
 setNotifications((prev) =>
 prev.map((n) => (n.id === id ? { ...n, read: true } : n))
 );

 const deleteNotification = (id: string) =>
 setNotifications((prev) => prev.filter((n) => n.id !== id));

 const markAllAsRead = () =>
 setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

 return (
 <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
 <div className="flex items-center gap-4">
 <SidebarTrigger className="-ml-2" />
 <div className="hidden h-6 w-px bg-border lg:block" />
 <div className="hidden lg:block">
 <h1 className="text-lg font-bold text-foreground">{title}</h1>
 {description && (
 <p className="text-sm text-muted-foreground">{description}</p>
 )}
 </div>
 </div>

 <div className="flex items-center gap-3">
 <div className="relative hidden md:block">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search customers, loans..."
 className="w-64 pl-9 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-primary"
 />
 </div>

 {branchBadgeLabel ? (
 <Badge variant="outline" className="hidden text-xs lg:inline-flex gap-1.5 bg-primary/5 text-primary border-primary/20">
 <MapPin className="h-3 w-3" />
 {branchBadgeLabel}
 </Badge>
 ) : null}

 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="relative">
 <Bell className="h-5 w-5" />
 {unreadCount > 0 && (
 <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
 {unreadCount}
 </span>
 )}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-80" onCloseAutoFocus={(e) => e.preventDefault()}>
 <DropdownMenuLabel className="flex items-center justify-between">
 <span>Notifications</span>
 <div className="flex items-center gap-2">
 {unreadCount > 0 && (
 <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>
 )}
 {unreadCount > 0 && (
 <button
 onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
 className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground hover:text-primary transition-colors"
 title="Mark all as read"
 >
 <CheckCheck className="h-3 w-3" />
 All read
 </button>
 )}
 </div>
 </DropdownMenuLabel>
 <DropdownMenuSeparator />

 {notifications.length === 0 ? (
 <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
 <Bell className="h-8 w-8 opacity-30" />
 <p className="text-sm">No notifications</p>
 </div>
 ) : (
 notifications.map((n) => (
 <div
 key={n.id}
 className={cn(
 "group relative flex flex-col gap-1 px-3 py-3 text-sm transition-colors hover:bg-accent/50",
 n.read && "opacity-60"
 )}
 >
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-center gap-2 min-w-0">
 <div className={cn("h-2 w-2 shrink-0 rounded-full", n.read ? "bg-muted-foreground/40" : n.dotClass)} />
 <span className={cn("font-medium leading-tight", n.read && "font-normal")}>{n.title}</span>
 </div>
 <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
 {!n.read && (
 <button
 onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
 title="Mark as read"
 className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
 >
 <Check className="h-3.5 w-3.5" />
 </button>
 )}
 <button
 onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
 title="Delete"
 className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
 >
 <X className="h-3.5 w-3.5" />
 </button>
 </div>
 </div>
 <span className="pl-4 text-muted-foreground">{n.message}</span>
 <span className="pl-4 text-xs text-muted-foreground/70">{n.time}</span>
 </div>
 ))
 )}

 {notifications.length > 0 && (
 <>
 <DropdownMenuSeparator />
 <div className="flex items-center justify-center py-2">
 <button className="text-sm font-medium text-primary hover:underline">
 View all notifications
 </button>
 </div>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </header>
 );
}
