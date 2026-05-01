"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, KeyRound, LayoutGrid, UserCog, UserPen, UserRoundMinus, UserRoundCheck } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StaffRecord } from "@/components/staff-management/types";
import {
  roleBadgeClass,
  roleHasPortalAccess,
  roleLabel,
} from "@/components/staff-management/utils";
import type {
  StaffWorkspaceAccessFlags,
  StaffWorkspaceDTO,
  StaffAccessPatchPayload,
} from "@/components/staff-management/staff-workspace-model";

export interface StaffWorkspaceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffRecord | null;
  workspace: StaffWorkspaceDTO | null;
  accessFlags: StaffWorkspaceAccessFlags;
  onAccessChange: (flags: StaffWorkspaceAccessFlags) => void;
  currentUserId: string;
  onEdit: (staff: StaffRecord) => void;
  onResetPassword: (staff: StaffRecord) => void;
  onToggleStatus: (staff: StaffRecord) => void;
}

function MomBarBlock({
  title,
  curr,
  prev,
  currLabel,
  prevLabel,
}: {
  title: string;
  curr: number;
  prev: number;
  currLabel: string;
  prevLabel: string;
}) {
  const data = [
    { name: prevLabel, value: prev },
    { name: currLabel, value: curr },
  ];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : String(v))} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StaffWorkspaceSheet({
  open,
  onOpenChange,
  staff,
  workspace,
  accessFlags,
  onAccessChange,
  currentUserId,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: StaffWorkspaceSheetProps) {
  if (!staff || !workspace) return null;

  const showPortalActions = roleHasPortalAccess(staff.role);
  const refMonth = workspace.monthly_series[workspace.monthly_series.length - 1];
  const prevMonth = workspace.monthly_series[workspace.monthly_series.length - 2];
  const currShort = refMonth?.month_label ?? "Current";
  const prevShort = prevMonth?.month_label ?? "Previous";

  const trendData = workspace.monthly_series.map((p) => ({
    month: p.month_label,
    disbursements: p.disbursements,
    collections: p.collections,
    customers: p.customers_added,
  }));

  const showAccessToggles = workspace.variant !== "limited" && showPortalActions;

  const patchAccess = (next: StaffWorkspaceAccessFlags) => {
    onAccessChange(next);
    const payload: StaffAccessPatchPayload = {
      user_id: staff.id,
      can_create_applications: next.can_create_applications,
      can_create_customers: next.can_create_customers,
      updated_by: currentUserId,
    };
    void payload;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 border-l border-emerald-200/50 bg-gradient-to-b from-emerald-50/50 via-background to-background p-0 sm:max-w-4xl dark:border-emerald-900/40 dark:from-emerald-950/15"
      >
        <SheetHeader className="space-y-3 border-b border-emerald-200/60 bg-emerald-50/40 px-4 py-4 text-left sm:px-6 sm:py-5 dark:border-emerald-900/40 dark:bg-emerald-950/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                {staff.full_name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <SheetTitle className="text-xl">{staff.full_name}</SheetTitle>
                <SheetDescription className="text-pretty">
                  {staff.employee_id} · {workspace.branch_name ?? "Branch"}
                </SheetDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={roleBadgeClass(staff.role)}>
                {roleLabel(staff.role)}
              </Badge>
              <Badge variant="outline" className={workspace.is_online ? "border-success/30 bg-success/10 text-success" : ""}>
                {workspace.is_online ? "Online" : "Offline"}
              </Badge>
              <Badge variant={staff.is_active ? "default" : "secondary"}>
                {staff.is_active ? "Active" : "Suspended"}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Last login: {workspace.last_login ? formatDateTime(workspace.last_login) : "Never"}
          </p>
        </SheetHeader>

        <Tabs defaultValue="users" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="border-b border-emerald-200/50 px-4 py-3 sm:px-6 dark:border-emerald-900/40">
            <TabsList className="grid h-10 w-full max-w-md grid-cols-2 rounded-full bg-emerald-100/70 p-1 dark:bg-emerald-900/30">
              <TabsTrigger
                value="users"
                className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm dark:data-[state=active]:text-emerald-300"
              >
                <UserCog className="size-4" />
                Users
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm dark:data-[state=active]:text-emerald-300"
              >
                <FileText className="size-4" />
                Reports &amp; access
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <TabsContent value="users" className="mt-0 space-y-6 px-4 py-4 sm:px-6 sm:py-5">
              {workspace.variant === "limited" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Overview</CardTitle>
                    <CardDescription>{workspace.limited_message}</CardDescription>
                  </CardHeader>
                </Card>
              ) : null}

              {workspace.variant === "loan_officer" && workspace.manager ? (
                <Card className="border-border/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Reporting line</CardTitle>
                    <CardDescription>Branch and branch manager for this officer.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Branch</p>
                      <p className="font-medium">{workspace.branch_name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Branch manager</p>
                      <p className="font-medium">{workspace.manager.full_name}</p>
                      <p className="text-xs text-muted-foreground">{workspace.manager.employee_id}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {workspace.variant === "branch_manager" && workspace.branch_sections?.length ? (
                <div className="space-y-4">
                  {workspace.branch_sections.map((section) => (
                    <Card key={section.branch_id} className="border-border/80">
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <LayoutGrid className="size-4 text-primary" />
                            {section.branch_name}
                          </CardTitle>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{section.stats.customers} customers</span>
                            <span>·</span>
                            <span>{section.stats.loans} loans</span>
                            <span>·</span>
                            <span>O/S {formatCurrency(section.stats.outstanding)}</span>
                          </div>
                        </div>
                        <CardDescription>Loan officers and top customers by disbursed principal.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {section.loan_officers.length ? (
                          <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Loan officers
                            </p>
                            <div className="space-y-2">
                              {section.loan_officers.map((o) => (
                                <div
                                  key={o.user_id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                                >
                                  <span className="font-medium">{o.full_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {o.customer_count} customers · {formatCurrency(o.loan_principal_total)} booked
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No loan officers in this branch.</p>
                        )}
                        <Separator />
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Customer preview
                          </p>
                          <div className="overflow-x-auto rounded-md border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                                  <th className="p-2 font-medium">Customer</th>
                                  <th className="p-2 font-medium">Loans</th>
                                  <th className="p-2 font-medium">Principal</th>
                                  <th className="p-2 font-medium">Outstanding</th>
                                </tr>
                              </thead>
                              <tbody>
                                {section.customer_preview.map((row) => (
                                  <tr key={row.customer_id} className="border-b border-border/50 last:border-0">
                                    <td className="p-2 font-medium">{row.customer_name}</td>
                                    <td className="p-2">{row.loan_count}</td>
                                    <td className="p-2">{formatCurrency(row.principal_total)}</td>
                                    <td className="p-2">{formatCurrency(row.outstanding_total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {workspace.variant === "loan_officer" && workspace.collection_by_customer?.length ? (
                <Card className="border-border/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Portfolio</CardTitle>
                    <CardDescription>Customers, amounts, and collections recorded by this officer.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                            <th className="p-2 font-medium">Customer</th>
                            <th className="p-2 font-medium">Loans</th>
                            <th className="p-2 font-medium">Principal</th>
                            <th className="p-2 font-medium">Outstanding</th>
                            <th className="p-2 font-medium">Collected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workspace.collection_by_customer.map((row) => (
                            <tr key={row.customer_id} className="border-b border-border/50 last:border-0">
                              <td className="p-2 font-medium">{row.customer_name}</td>
                              <td className="p-2">{row.loan_count}</td>
                              <td className="p-2">{formatCurrency(row.principal_total)}</td>
                              <td className="p-2">{formatCurrency(row.outstanding_total)}</td>
                              <td className="p-2">{formatCurrency(row.collections_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="reports" className="mt-0 space-y-6 px-4 py-4 sm:px-6 sm:py-5">
              <p className="text-xs text-muted-foreground">
                Trends are derived from mock disbursement, customer, and payment dates. Replace with API time series when
                available.
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <MomBarBlock
                  title="Disbursements (principal)"
                  curr={workspace.mom_comparison.disbursements_curr}
                  prev={workspace.mom_comparison.disbursements_prev}
                  currLabel={currShort}
                  prevLabel={prevShort}
                />
                <MomBarBlock
                  title="Collections"
                  curr={workspace.mom_comparison.collections_curr}
                  prev={workspace.mom_comparison.collections_prev}
                  currLabel={currShort}
                  prevLabel={prevShort}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <MomBarBlock
                  title="New customers"
                  curr={workspace.mom_comparison.customers_curr}
                  prev={workspace.mom_comparison.customers_prev}
                  currLabel={currShort}
                  prevLabel={prevShort}
                />
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Six-month trend</CardTitle>
                    <CardDescription>Disbursements vs collections</CardDescription>
                  </CardHeader>
                  <CardContent className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : String(v))} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="disbursements" fill="hsl(var(--primary))" name="Disbursements" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="collections" fill="hsl(142 76% 36%)" name="Collections" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {showAccessToggles ? (
                <Card className="border-border/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Operational access</CardTitle>
                    <CardDescription>
                      Restrict creation of applications or customers without suspending the account. Mirrors a future{" "}
                      <code className="text-xs">PATCH /users/:id/access</code>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3">
                      <div>
                        <p className="text-sm font-medium">Create loan applications</p>
                        <p className="text-xs text-muted-foreground">Submit new applications on behalf of customers.</p>
                      </div>
                      <Switch
                        checked={accessFlags.can_create_applications}
                        onCheckedChange={(checked) =>
                          patchAccess({ ...accessFlags, can_create_applications: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3">
                      <div>
                        <p className="text-sm font-medium">Create customers</p>
                        <p className="text-xs text-muted-foreground">Register new customer profiles in the branch.</p>
                      </div>
                      <Switch
                        checked={accessFlags.can_create_customers}
                        onCheckedChange={(checked) =>
                          patchAccess({ ...accessFlags, can_create_customers: checked })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex flex-wrap gap-2 border-t border-emerald-200/60 bg-emerald-50/40 px-4 py-4 sm:px-6 dark:border-emerald-900/40 dark:bg-emerald-950/10">
          <Button variant="outline" size="sm" onClick={() => onEdit(staff)}>
            <UserPen className="mr-2 size-4" />
            Edit
          </Button>
          {showPortalActions ? (
            <Button variant="outline" size="sm" onClick={() => onResetPassword(staff)}>
              <KeyRound className="mr-2 size-4" />
              Reset password
            </Button>
          ) : null}
          <Button
            variant={staff.is_active ? "destructive" : "default"}
            size="sm"
            onClick={() => onToggleStatus(staff)}
          >
            {staff.is_active ? (
              <>
                <UserRoundMinus className="mr-2 size-4" />
                Suspend
              </>
            ) : (
              <>
                <UserRoundCheck className="mr-2 size-4" />
                Activate
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
