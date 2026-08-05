"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 BarChart3,
 BookOpen,
 CreditCard,
 LayoutDashboard,
 LogOut,
 Scale,
 Settings,
 ShieldCheck,
 Wallet,
 WalletCards,
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
import { useOptionalBranchAssignment } from "@/components/branch-assignment-context";
import { useLanguage } from "@/components/language-provider";
import { tLabel } from "@/lib/i18n/labels";
import { invalidateFetchCache } from "@/lib/client-fetch-cache";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

const accountantNav = [
 { title: "Dashboard", href: "/accountant/dashboard", icon: LayoutDashboard },
 { title: "Payments", href: "/accountant/payments", icon: CreditCard },
 { title: "Reconciliation", href: "/accountant/reconciliation", icon: Scale },
 { title: "Cashbook", href: "/accountant/cashbook", icon: BookOpen },
 { title: "Collections", href: "/accountant/collections/activities", icon: ShieldCheck },
 { title: "Disbursements", href: "/accountant/disbursements", icon: WalletCards },
 { title: "Active Loans", href: "/accountant/loans", icon: Wallet },
 { title: "Reports", href: "/accountant/reports", icon: BarChart3 },
 { title: "Settings", href: "/accountant/settings", icon: Settings },
];

export function AccountantSidebar({
 user,
 branchLabel,
}: {
 user: SessionUser;
 branchLabel: string;
}) {
 const pathname = usePathname();
 const branchCtx = useOptionalBranchAssignment();
 const { language } = useLanguage();
 const L = (text: string) => tLabel(text, language);
 const resolvedBranchLabel =
 branchCtx?.branches.find((b) => b.id === user.branch_id)?.name ?? branchLabel;

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
 <p className="text-sm font-bold text-sidebar-foreground">{L("Falco Finance Portal")}</p>
 <p className="truncate text-[11px] text-sidebar-foreground/60">{resolvedBranchLabel}</p>
 </div>
 </div>
 </SidebarHeader>
 <SidebarContent className="px-2 py-4">
 <SidebarMenu>
 {accountantNav.map((item) => (
 <SidebarMenuItem key={item.href}>
 <SidebarMenuButton
 asChild
 isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
 className={cn(
 (pathname === item.href || pathname.startsWith(`${item.href}/`)) &&
 "bg-sidebar-primary/15 font-medium text-sidebar-primary"
 )}
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
 <Badge
 variant="outline"
 className="mt-0.5 w-fit border-sidebar-primary/40 text-[10px] capitalize text-sidebar-primary"
 >
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
