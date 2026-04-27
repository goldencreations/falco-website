"use client";

import { CreditCard, FileText, AlertCircle, CheckCircle, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  payments,
  loanApplications,
  loans,
  getCustomerById,
  formatCurrency,
  formatDateTime,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ActivityType = "payment" | "application" | "disbursement" | "overdue";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  status?: string;
  timestamp: string;
}

function getRecentActivities(): Activity[] {
  const activities: Activity[] = [];

  // Add recent payments
  payments.slice(0, 3).forEach((payment) => {
    const customer = getCustomerById(payment.customer_id);
    activities.push({
      id: `pay-${payment.id}`,
      type: "payment",
      title: "Payment Received",
      description: `${customer?.first_name} ${customer?.last_name} paid ${formatCurrency(payment.amount)}`,
      amount: payment.amount,
      status: payment.status,
      timestamp: payment.payment_date,
    });
  });

  // Add recent applications
  loanApplications.slice(0, 2).forEach((app) => {
    const customer = getCustomerById(app.customer_id);
    activities.push({
      id: `app-${app.id}`,
      type: "application",
      title: "Loan Application",
      description: `${customer?.first_name} ${customer?.last_name} applied for ${formatCurrency(app.requested_amount)}`,
      amount: app.requested_amount,
      status: app.status,
      timestamp: app.created_at,
    });
  });

  // Add overdue loans
  loans
    .filter((loan) => loan.days_in_arrears > 0)
    .slice(0, 2)
    .forEach((loan) => {
      const customer = getCustomerById(loan.customer_id);
      activities.push({
        id: `overdue-${loan.id}`,
        type: "overdue",
        title: "Loan Overdue",
        description: `${customer?.first_name} ${customer?.last_name} - ${loan.days_in_arrears} days overdue`,
        amount: loan.total_outstanding,
        status: loan.risk_classification,
        timestamp: loan.updated_at,
      });
    });

  // Sort by timestamp
  return activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

const typeConfig = {
  payment: { 
    icon: CreditCard, 
    bgColor: "bg-success/10", 
    iconColor: "text-success",
    ringColor: "ring-success/20"
  },
  application: { 
    icon: FileText, 
    bgColor: "bg-info/10", 
    iconColor: "text-info",
    ringColor: "ring-info/20"
  },
  disbursement: { 
    icon: CheckCircle, 
    bgColor: "bg-primary/10", 
    iconColor: "text-primary",
    ringColor: "ring-primary/20"
  },
  overdue: { 
    icon: AlertCircle, 
    bgColor: "bg-destructive/10", 
    iconColor: "text-destructive",
    ringColor: "ring-destructive/20"
  },
};

export function RecentActivity() {
  const activities = getRecentActivities();

  return (
    <Card className="col-span-2 border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Latest transactions and updates</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-primary gap-1">
          <Link href="/payments">
            View All
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity) => {
            const config = typeConfig[activity.type];
            const Icon = config.icon;
            return (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-colors"
              >
                <div
                  className={cn(
                    "mt-0.5 rounded-xl p-2.5 ring-2",
                    config.bgColor,
                    config.iconColor,
                    config.ringColor
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{activity.title}</p>
                    {activity.status && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium shrink-0",
                          activity.type === "overdue"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : activity.status === "completed" ||
                                activity.status === "approved"
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {activity.status.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {formatDateTime(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
