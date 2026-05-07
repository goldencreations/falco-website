"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Settings,
  UserSquare2,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

const officerNav = [
  { title: "Dashboard", href: "/officer/dashboard", icon: LayoutDashboard },
  { title: "Customers", href: "/officer/customers", icon: UserSquare2 },
  { title: "Loan Applications", href: "/officer/applications", icon: ClipboardList },
  { title: "Active Loans", href: "/officer/loans", icon: Wallet },
  { title: "Payments", href: "/officer/payments", icon: CreditCard },
  { title: "Reports", href: "/officer/reports", icon: BarChart3 },
  { title: "Settings", href: "/officer/settings", icon: Settings },
];

export function OfficerSidebar({ user, branchLabel }: { user: SessionUser; branchLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <Sidebar className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <p className="text-sm font-bold text-sidebar-foreground">Falco Officer Portal</p>
        <p className="text-[11px] text-sidebar-foreground/60">{branchLabel}</p>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        <SidebarMenu>
          {officerNav.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                className={cn(pathname === item.href && "bg-sidebar-primary/15 font-medium text-sidebar-primary")}
              >
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
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
              {user.full_name
                .split(" ")
                .map((part) => part[0])
                .join("")}
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
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
