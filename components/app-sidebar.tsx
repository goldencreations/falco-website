"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  TrendingUp,
  Scale,
  Calculator,
  MapPin,
  DatabaseBackup,
  Users2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { currentUser } from "@/lib/mock-data";

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
          { title: "Pending Review", href: "/applications?status=under_review" },
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
        title: "Collections",
        href: "/collections",
        icon: AlertTriangle,
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
          { title: "Portfolio Summary", href: "/reports" },
          { title: "Aging Analysis", href: "/reports/aging" },
          { title: "Disbursement Report", href: "/reports/disbursements" },
          { title: "Collection Report", href: "/reports/collections" },
        ],
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
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const visibleNavigation = useMemo(() => {
    const role = currentUser.role;
    const staffGroup: { title: string; items: SidebarNavItem[] } = {
      title: "Staff",
      items: [
        {
          title: "Team & assignments",
          href: "/staff/team",
          icon: Users2,
        },
      ],
    };
    return navigation
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.href === "/users") return role === "super_admin";
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0)
      .flatMap((group) =>
        group.title === "Collections" && (role === "branch_manager" || role === "super_admin")
          ? [group, staffGroup]
          : [group]
      );
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  return (
    <Sidebar className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 shadow-lg shadow-sidebar-primary/20">
            <TrendingUp className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">
              Falco Financial
            </span>
            <span className="text-[11px] text-sidebar-foreground/50 font-medium">
              Loan Management System
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {visibleNavigation.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) =>
                  "subItems" in item ? (
                    <Collapsible key={item.title} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className={cn(
                              "w-full transition-colors",
                              pathname.startsWith(item.href) &&
                                "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.subItems.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === subItem.href}
                                  className={cn(
                                    pathname === subItem.href && "text-sidebar-primary font-medium"
                                  )}
                                >
                                  <Link href={subItem.href}>
                                    {subItem.title}
                                  </Link>
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
                        isActive={pathname === item.href}
                        className={cn(
                          "transition-colors",
                          pathname === item.href && "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
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
              {currentUser.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">
              {currentUser.full_name}
            </span>
            <span className="text-[11px] capitalize text-sidebar-primary/80 font-medium">
              {currentUser.role.replace("_", " ")}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-lg p-2 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
