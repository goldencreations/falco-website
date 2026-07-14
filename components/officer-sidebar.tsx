"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 Calculator,
 ClipboardList,
 LayoutDashboard,
 LogOut,
 MapPin,
 Scale,
 Settings,
 UserSquare2,
 Users,
 Wallet,
} from "lucide-react";
import {
 Sidebar,
 SidebarContent,
 SidebarFooter,
 SidebarHeader,
 SidebarMenu,
 SidebarMenuButton,
 SidebarMenuItem,
} from "@/components/ui/sidebar";
import { FalcoLogo } from "@/components/falco-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/language-provider";
import { tLabel } from "@/lib/i18n/labels";
import { invalidateFetchCache } from "@/lib/client-fetch-cache";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

const officerNav = [
 { title: "Dashboard", href: "/officer/dashboard", icon: LayoutDashboard },
 { title: "Leads", href: "/officer/leads", icon: MapPin },
 { title: "Customers", href: "/officer/customers", icon: UserSquare2 },
 { title: "Loan Applications", href: "/officer/applications", icon: ClipboardList },
 { title: "Active Loans", href: "/officer/loans", icon: Wallet },
 { title: "Credit Analysis", href: "/officer/credit-analysis", icon: Scale },
 { title: "Loan Calculator", href: "/officer/loan-calculator", icon: Calculator },
 { title: "Vikundi", href: "/officer/groups", icon: Users },
 { title: "Settings", href: "/officer/settings", icon: Settings },
];

export function OfficerSidebar({ user, branchLabel }: { user: SessionUser; branchLabel: string }) {
 const pathname = usePathname();
 const { language } = useLanguage();
 const L = (text: string) => tLabel(text, language);

 const handleLogout = async () => {
 await fetch("/api/logout", { method: "POST" });
 invalidateFetchCache();
 window.location.assign("/");
 };

 return (
 <Sidebar className="border-sidebar-border">
 <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
 <div className="flex items-center gap-3">
 <FalcoLogo size="md" />
 <div className="min-w-0">
 <p className="text-sm font-bold text-sidebar-foreground">{L("Falco Officer Portal")}</p>
 <p className="truncate text-[11px] text-sidebar-foreground/60">{branchLabel}</p>
 </div>
 </div>
 </SidebarHeader>
 <SidebarContent className="px-2 py-4">
 <SidebarMenu>
 {officerNav.map((item) => {
 const active =
 pathname === item.href ||
 (item.href !== "/officer/dashboard" && pathname.startsWith(`${item.href}/`));
 return (
 <SidebarMenuItem key={item.href}>
 <SidebarMenuButton
 asChild
 isActive={active}
 className={cn(active && "bg-sidebar-primary/15 font-medium text-sidebar-primary")}
 >
 <Link href={item.href}>
 <item.icon className="h-4 w-4" />
 <span>{L(item.title)}</span>
 </Link>
 </SidebarMenuButton>
 </SidebarMenuItem>
 );
 })}
 </SidebarMenu>
 </SidebarContent>
 <SidebarFooter className="border-t border-sidebar-border p-4">
 <div className="flex items-center gap-3">
 <Avatar className="h-10 w-10 ring-2 ring-sidebar-primary/20">
 <AvatarFallback className="bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sm font-semibold text-sidebar-primary-foreground">
 {(user.full_name || "U")
 .split(/\s+/)
 .filter(Boolean)
 .map((part) => part[0])
 .join("")
 .slice(0, 2) || "U"}
 </AvatarFallback>
 </Avatar>
 <div className="flex flex-1 flex-col">
 <span className="text-sm font-semibold text-sidebar-foreground">{user.full_name}</span>
 <Badge variant="outline" className="mt-0.5 w-fit border-sidebar-primary/40 text-[10px] capitalize text-sidebar-primary">
 {user.role.replace("_", " ")}
 </Badge>
 </div>
 <button
 type="button"
 onClick={handleLogout}
 className="rounded-lg p-2 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
 aria-label={L("Logout")}
 >
 <LogOut className="h-4 w-4" />
 </button>
 </div>
 </SidebarFooter>
 </Sidebar>
 );
}
