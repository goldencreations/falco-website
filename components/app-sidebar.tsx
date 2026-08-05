"use client";

import { useMemo, useState } from "react";
import {
 LayoutDashboard,
 Users,
 FileText,
 CreditCard,
 AlertTriangle,
 BarChart3,
 Settings,
 LogOut,
 Wallet,
 Building2,
 UserCog,
 ChevronDown,
 Scale,
 Calculator,
 MapPin,
 DatabaseBackup,
 BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FalcoLogo } from "@/components/falco-logo";
import { cn } from "@/lib/utils";
import {
 Sidebar,
 SidebarContent,
 SidebarFooter,
 SidebarGroup,
 SidebarGroupContent,
 SidebarGroupLabel,
 SidebarHeader,
 SidebarMenu,
 SidebarMenuButton,
 SidebarMenuItem,
 SidebarMenuSub,
 SidebarMenuSubButton,
 SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
 Collapsible,
 CollapsibleContent,
 CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/components/language-provider";
import { tLabel } from "@/lib/i18n/labels";
import { invalidateFetchCache } from "@/lib/client-fetch-cache";
import { useSessionUser } from "@/lib/use-session-user";
import { NavigationLink, useNavigationTransition } from "@/components/navigation-transition-context";

type SidebarNavItem =
 | {
 title: string;
 href: string;
 icon: LucideIcon;
 subItems: { title: string; href: string }[];
 }
 | {
 title: string;
 href: string;
 icon: LucideIcon;
 };

const navigation: { title: string; items: SidebarNavItem[] }[] = [
 {
 title: "Main",
 items: [
 {
 title: "Dashboard",
 href: "/dashboard",
 icon: LayoutDashboard,
 },
 ],
 },
 {
 title: "Loan Management",
 items: [
 {
 title: "Customers",
 href: "/customers",
 icon: Users,
 },
 {
 title: "Leads",
 href: "/leads",
 icon: MapPin,
 },
 {
 title: "Branches",
 href: "/branches",
 icon: Building2,
 },
 {
 title: "Loan Applications",
 href: "/applications",
 icon: FileText,
 subItems: [
 { title: "All Applications", href: "/applications" },
 { title: "New Application", href: "/applications/new" },
 { title: "Pending Review", href: "/applications/pending-review" },
 ],
 },
 {
 title: "Active Loans",
 href: "/loans",
 icon: Wallet,
 },
 {
 title: "Loan Disbursement",
 href: "/disbursements",
 icon: CreditCard,
 },
 {
 title: "Vikundi / Group Loans",
 href: "/groups",
 icon: Users,
 },
 ],
 },
 {
 title: "Credit Analysis",
 items: [
 {
 title: "Credit Analysis",
 href: "/credit-analysis",
 icon: Scale,
 },
 {
 title: "Loan Calculator",
 href: "/loan-calculator",
 icon: Calculator,
 },
 ],
 },
 {
 title: "Collections",
 items: [
 {
 title: "Payments",
 href: "/payments",
 icon: CreditCard,
 },
 {
 title: "Reconciliation",
 href: "/reconciliation",
 icon: Scale,
 },
 {
 title: "Collections",
 href: "/collections",
 icon: AlertTriangle,
 subItems: [
 { title: "Recent activities", href: "/collections/activities" },
 { title: "Collection queue", href: "/collections/queue" },
 { title: "Vikundi", href: "/collections/vikundi" },
 ],
 },
 ],
 },
 {
 title: "Reports & Admin",
 items: [
 {
 title: "Reports",
 href: "/reports",
 icon: BarChart3,
 subItems: [
 { title: "Reports Overview", href: "/reports" },
 { title: "Lead Performance", href: "/reports?view=leads-performance" },
 { title: "Customer Demographics", href: "/reports?view=customer-demographics" },
 { title: "Application Analytics", href: "/reports?view=applications" },
 { title: "Expected Collections", href: "/reports?view=expected-collections" },
 { title: "Portfolio & Aging", href: "/reports?view=portfolio-aging" },
 { title: "Disbursements", href: "/reports?view=disbursements" },
 { title: "Group Performance", href: "/reports?view=groups-performance" },
 { title: "Financial Ledger", href: "/reports?view=financial-ledger" },
 ],
 },
 {
 title: "Cashbook",
 href: "/cashbook",
 icon: BookOpen,
 },
 {
 title: "Loan Products",
 href: "/products",
 icon: Building2,
 },
 {
 title: "Staff Management",
 href: "/users",
 icon: UserCog,
 },
 {
 title: "Backup",
 href: "/backup",
 icon: DatabaseBackup,
 },
 {
 title: "Settings",
 href: "/settings",
 icon: Settings,
 },
 ],
 },
];

export function AppSidebar() {
 const { activePath } = useNavigationTransition();
 const { user } = useSessionUser();
 const { language } = useLanguage();
 const L = (text: string) => tLabel(text, language);
 const [isLoggingOut, setIsLoggingOut] = useState(false);
 const activePathname = activePath.split("?")[0];
 const activeQuery = useMemo(() => {
  if (activePath.includes("?")) {
   return new URLSearchParams(activePath.slice(activePath.indexOf("?") + 1));
  }
  if (typeof window !== "undefined") {
   return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
 }, [activePath]);
 const isActiveHref = (href: string) => {
 const pathname = href.split("?")[0];
 return activePathname === pathname || activePathname.startsWith(`${pathname}/`);
 };
 const isActiveSubItem = (href: string) => {
 const [pathname, query = ""] = href.split("?");
 if (activePathname !== pathname) return false;
 if (pathname !== "/reports") return true;
 const targetView = new URLSearchParams(query).get("view");
 return targetView ? activeQuery.get("view") === targetView : !activeQuery.get("view");
 };

 const visibleNavigation = useMemo(() => {
 const role = user?.role ?? "loan_officer";
 return navigation
 .map((group) => ({
 ...group,
 items: group.items.filter((item) => {
        if (item.href === "/users") return role === "super_admin";
        if (item.href === "/cashbook") return role === "super_admin" || role === "accountant";
        return true;
 }),
 }))
 .filter((group) => group.items.length > 0);
 }, [user?.role]);

 const handleLogout = async () => {
 setIsLoggingOut(true);
 try {
 await fetch("/api/logout", { method: "POST" });
 } finally {
 invalidateFetchCache();
 // Full navigation clears any leftover client session state from the previous account.
 window.location.assign("/");
 }
 };

 return (
 <Sidebar className="border-sidebar-border">
 <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
 <div className="flex items-center gap-3">
 <FalcoLogo size="md" />
 <div className="flex min-w-0 flex-col">
 <span className="text-sm font-bold text-sidebar-foreground tracking-tight">
 {L("Falco Financial")}
 </span>
 <span className="text-[11px] text-sidebar-foreground/50 font-medium">
 {L("Loan Management System")}
 </span>
 </div>
 </div>
 </SidebarHeader>

 <SidebarContent className="px-2 py-4">
 {visibleNavigation.map((group) => (
 <SidebarGroup key={group.title}>
 <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
 {L(group.title)}
 </SidebarGroupLabel>
 <SidebarGroupContent>
 <SidebarMenu>
 {group.items.map((item) =>
 "subItems" in item ? (
 <Collapsible
 key={item.title}
 className="group/collapsible"
 defaultOpen={isActiveHref(item.href)}
 >
 <SidebarMenuItem>
 <CollapsibleTrigger asChild>
 <SidebarMenuButton
 className={cn(
 "w-full transition-colors",
 isActiveHref(item.href) &&
 "bg-sidebar-primary/15 text-sidebar-primary font-medium"
 )}
 >
 <item.icon className="h-4 w-4" />
 <span>{L(item.title)}</span>
 <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
 </SidebarMenuButton>
 </CollapsibleTrigger>
 <CollapsibleContent>
 <SidebarMenuSub>
 {item.subItems.map((subItem) => (
 <SidebarMenuSubItem key={subItem.href}>
 <SidebarMenuSubButton
 asChild
 isActive={isActiveSubItem(subItem.href)}
 className={cn(
 isActiveSubItem(subItem.href) && "bg-sidebar-primary/15 text-sidebar-primary font-medium"
 )}
 >
 <NavigationLink href={subItem.href}>
 {L(subItem.title)}
 </NavigationLink>
 </SidebarMenuSubButton>
 </SidebarMenuSubItem>
 ))}
 </SidebarMenuSub>
 </CollapsibleContent>
 </SidebarMenuItem>
 </Collapsible>
 ) : (
 <SidebarMenuItem key={item.title}>
 <SidebarMenuButton
 asChild
 isActive={isActiveHref(item.href)}
 className={cn(
 "transition-colors",
 isActiveHref(item.href) && "bg-sidebar-primary/15 text-sidebar-primary font-medium"
 )}
 >
 <NavigationLink href={item.href}>
 <item.icon className="h-4 w-4" />
 <span>{L(item.title)}</span>
 </NavigationLink>
 </SidebarMenuButton>
 </SidebarMenuItem>
 )
 )}
 </SidebarMenu>
 </SidebarGroupContent>
 </SidebarGroup>
 ))}
 </SidebarContent>

 <SidebarFooter className="border-t border-sidebar-border p-4">
 <div className="flex items-center gap-3">
 <Avatar className="h-10 w-10 ring-2 ring-sidebar-primary/20">
 <AvatarFallback className="bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground text-sm font-semibold">
 {(user?.full_name ?? "?")
 .split(" ")
 .map((n) => n[0])
 .join("")}
 </AvatarFallback>
 </Avatar>
 <div className="flex flex-1 flex-col">
 <span className="text-sm font-semibold text-sidebar-foreground">
 {user?.full_name ?? "—"}
 </span>
 <span className="text-[11px] capitalize text-sidebar-primary/80 font-medium">
 {(user?.role ?? "").replace("_", " ")}
 </span>
 </div>
 <button
 type="button"
 onClick={handleLogout}
 disabled={isLoggingOut}
 className="rounded-lg p-2 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:cursor-not-allowed disabled:opacity-60"
 aria-label={L("Logout")}
 title={L("Logout")}
 >
 <LogOut className="h-4 w-4" />
 </button>
 </div>
 </SidebarFooter>
 </Sidebar>
 );
}
