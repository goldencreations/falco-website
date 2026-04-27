"use client";

import { Bell, Search, MapPin } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { branches, currentUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title: string;
  description?: string;
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  const currentBranch = branches.find((b) => b.id === currentUser.branch_id);

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

        <Badge variant="outline" className="hidden text-xs lg:inline-flex gap-1.5 bg-primary/5 text-primary border-primary/20">
          <MapPin className="h-3 w-3" />
          {currentBranch?.name}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              <Badge variant="secondary" className="text-[10px]">3 new</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-info" />
                <span className="font-medium">New loan application</span>
              </div>
              <span className="text-sm text-muted-foreground pl-4">
                Charles Mwenda submitted a TZS 5,000,000 loan application
              </span>
              <span className="text-xs text-muted-foreground/70 pl-4">2 hours ago</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="font-medium">Payment received</span>
              </div>
              <span className="text-sm text-muted-foreground pl-4">
                Emmanuel Mwakyusa paid TZS 793,334 via M-Pesa
              </span>
              <span className="text-xs text-muted-foreground/70 pl-4">5 hours ago</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="font-medium">Loan overdue alert</span>
              </div>
              <span className="text-sm text-muted-foreground pl-4">
                Robert Mtei&apos;s loan is now 35 days overdue
              </span>
              <span className="text-xs text-muted-foreground/70 pl-4">1 day ago</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={cn(
              "justify-center font-medium text-primary hover:text-primary cursor-pointer"
            )}>
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
