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
 <Card className="border border-border/70 shadow-sm">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <div>
 <CardTitle className="text-lg">Recent Activity</CardTitle>
 <CardDescription>Latest transactions and updates</CardDescription>
 </div>
 <div className="flex items-center gap-2">
 <Badge variant="outline" className="hidden text-xs sm:inline-flex">
 {activities.length} updates
 </Badge>
 <Button variant="ghost" size="sm" asChild className="gap-1 text-primary">
 <Link href="/payments">
 View All
 <ArrowUpRight className="h-4 w-4" />
 </Link>
 </Button>
 </div>
 </CardHeader>
 <CardContent className="p-0">
 <div className="overflow-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border/60 bg-muted/30">
 <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Activity
 </th>
 <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Details
 </th>
 <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Status
 </th>
 <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground whitespace-nowrap">
 Date
 </th>
 </tr>
 </thead>
 <tbody>
 {activities.map((activity, i) => {
 const config = typeConfig[activity.type];
 const Icon = config.icon;
 return (
 <tr
 key={activity.id}
 className={cn(
 "transition-colors hover:bg-muted/30",
 i !== activities.length - 1 && "border-b border-border/40"
 )}
 >
 {/* Activity */}
 <td className="px-4 py-3 font-medium whitespace-nowrap">
 <div className="flex items-center gap-2.5">
 <div
 className={cn(
 "rounded-lg p-1.5 ring-1",
 config.bgColor,
 config.iconColor,
 config.ringColor
 )}
 >
 <Icon className="h-3.5 w-3.5" />
 </div>
 {activity.title}
 </div>
 </td>

 {/* Details */}
 <td className="max-w-xs px-4 py-3 text-muted-foreground">
 <span className="line-clamp-1">{activity.description}</span>
 </td>

 {/* Status */}
 <td className="px-4 py-3">
 {activity.status ? (
 <Badge
 variant="outline"
 className={cn(
 "text-[10px] font-medium",
 activity.type === "overdue"
 ? "border-destructive/20 bg-destructive/10 text-destructive"
 : activity.status === "completed" || activity.status === "approved"
 ? "border-success/20 bg-success/10 text-success"
 : "bg-muted text-muted-foreground"
 )}
 >
 {activity.status.replace(/_/g, " ")}
 </Badge>
 ) : (
 <span className="text-muted-foreground/50">—</span>
 )}
 </td>

 {/* Date */}
 <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
 {formatDateTime(activity.timestamp)}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </CardContent>
 </Card>
 );
}
