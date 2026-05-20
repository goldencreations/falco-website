"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
 BarChart3,
 ClipboardCheck,
 ClipboardList,
 CreditCard,
 LayoutDashboard,
 LogOut,
 MapPin,
 Settings,
 Scale,
 ShieldCheck,
 Users2,
 UserSquare2,
 Wallet,
} from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/language-provider";
import { tLabel } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

const managerNav = [
 { title: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
 { title: "Leads", href: "/manager/leads", icon: MapPin },
 { title: "Loan Applications", href: "/manager/applications", icon: ClipboardList },
 { title: "Pending Review", href: "/manager/applications/pending-review", icon: ClipboardCheck },
 { title: "Customers", href: "/manager/customers", icon: UserSquare2 },
 { title: "Active Loans", href: "/manager/loans", icon: Wallet },
 { title: "Payments", href: "/manager/payments", icon: CreditCard },
 { title: "Reconciliation", href: "/manager/reconciliation", icon: Scale },
 { title: "Team & Assignment", href: "/manager/team", icon: Users2 },
 { title: "Reports", href: "/manager/reports", icon: BarChart3 },
 { title: "Collections", href: "/manager/collections", icon: ShieldCheck },
 { title: "Settings", href: "/manager/settings", icon: Settings },
];

export function ManagerSidebar({ user, branchLabel }: { user: SessionUser; branchLabel: string }) {
 const pathname = usePathname();
 const router = useRouter();
 const { language } = useLanguage();
 const L = (text: string) => tLabel(text, language);

 const handleLogout = async () => {
 await fetch("/api/logout", { method: "POST" });
 router.push("/");
 router.refresh();
 };

 return (
 <Sidebar className="border-sidebar-border">
 <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
 <p className="text-sm font-bold text-sidebar-foreground">{L("Falco Manager Portal")}</p>
 <p className="text-[11px] text-sidebar-foreground/60">{branchLabel}</p>
 </SidebarHeader>
 <SidebarContent className="px-2 py-4">
 <SidebarMenu>
 {managerNav.map((item) => (
 <SidebarMenuItem key={item.href}>
 <SidebarMenuButton
 asChild
 isActive={pathname === item.href}
 className={cn(pathname === item.href && "bg-sidebar-primary/15 text-sidebar-primary font-medium")}
 >
 <Link href={item.href}>
 <item.icon className="h-4 w-4" />
 <span>{L(item.title)}</span>
 </Link>
 </SidebarMenuButton>
 </SidebarMenuItem>
 ))}
 </SidebarMenu>
 </SidebarContent>
 <SidebarFooter className="border-t border-sidebar-border p-4">
 <div className="flex items-center gap-3">
 <Avatar className="h-10 w-10 ring-2 ring-sidebar-primary/20">
 <AvatarFallback className="bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground text-sm font-semibold">
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
