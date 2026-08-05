"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, User, Wallet } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { extractGroupDetail } from "@/lib/group-adapters";
import { leadershipRoleForCustomer } from "@/lib/group-members";
import { formatCurrency } from "@/lib/formatters";
import { resolvePortalHref } from "@/lib/portal-paths";
import { useSessionUser } from "@/lib/use-session-user";
import type { Customer, RiskGrade } from "@/lib/types";
import type { VikundiMemberCollectionRow } from "@/lib/vikundi-collection-summary";

const riskVariant: Record<RiskGrade, "default" | "secondary" | "destructive" | "outline"> = {
  A: "default",
  B: "secondary",
  C: "outline",
  D: "destructive",
  E: "destructive",
};

export default function GroupMemberDetailPage() {
  const params = useParams<{ id: string; customerId: string }>();
  const groupId = typeof params?.id === "string" ? params.id : "";
  const customerId = typeof params?.customerId === "string" ? params.customerId : "";
  const { user } = useSessionUser();

  const groupsHref = resolvePortalHref(user?.role, "/groups");
  const groupHref = groupId ? resolvePortalHref(user?.role, `/groups/${groupId}`) : groupsHref;
  const customerHref = customerId
    ? resolvePortalHref(user?.role, `/customers/${customerId}`)
    : groupsHref;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [memberRow, setMemberRow] = useState<VikundiMemberCollectionRow | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId || !customerId) {
      setError("Member not found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [groupRes, customerRes, collectionRes] = await Promise.all([
        fetch(`/api/groups/${encodeURIComponent(groupId)}`, { credentials: "include" }),
        fetch(`/api/customers/${encodeURIComponent(customerId)}`, { credentials: "include" }),
        fetch(`/api/collections/vikundi/${encodeURIComponent(groupId)}`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const groupJson = (await groupRes.json()) as unknown;
      if (!groupRes.ok) {
        setError("Could not load vikundi details.");
        return;
      }

      const group = extractGroupDetail(groupJson);
      if (!group) {
        setError("Vikundi not found");
        return;
      }
      setGroupName(group.group_name);
      setRole(leadershipRoleForCustomer(customerId, group));

      if (customerRes.ok) {
        const row = extractCustomerDetail((await customerRes.json()) as unknown);
        if (row) setCustomer(adaptApiCustomerRowToCustomer(row));
      }

      if (collectionRes.ok) {
        const collectionJson = (await collectionRes.json()) as {
          detail?: { members?: VikundiMemberCollectionRow[] };
        };
        const member = collectionJson.detail?.members?.find(
          (row) => row.customer_id === customerId
        );
        setMemberRow(member ?? null);
      }
    } catch {
      setError("Could not load member details.");
    } finally {
      setLoading(false);
    }
  }, [groupId, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = memberRow?.customer_name?.trim()
    || (customer ? `${customer.first_name} ${customer.last_name}`.trim() : "")
    || "Member";

  if (loading) {
    return (
      <>
        <DashboardHeader title="Member" description="Loading member profile…" />
        <main className="flex flex-1 items-center justify-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <DashboardHeader title="Member Not Found" />
        <main className="flex-1 space-y-4 p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button asChild variant="outline">
            <Link href={groupHref}>Back to Vikundi</Link>
          </Button>
        </main>
      </>
    );
  }

  const outstanding = memberRow?.total_outstanding ?? 0;
  const riskGrade = (customer?.risk_grade ?? "") as RiskGrade;

  return (
    <>
      <DashboardHeader
        title={displayName}
        description={groupName ? `Member of ${groupName}` : "Vikundi member"}
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={groupHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to {groupName || "Vikundi"}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={customerHref}>
                <User className="mr-2 h-4 w-4" />
                Full customer profile
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Amount owed in this vikundi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-3xl font-bold tabular-nums ${
                    outstanding > 0 ? "text-destructive" : ""
                  }`}
                >
                  {formatCurrency(outstanding)}
                </p>
                {memberRow ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {memberRow.active_loans} active loan
                    {memberRow.active_loans === 1 ? "" : "s"} of {memberRow.loan_count} total
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Vikundi role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant={role ? "default" : "secondary"} className="capitalize">
                  {role ?? memberRow?.role ?? "Member"}
                </Badge>
                {memberRow?.monthly_income != null ? (
                  <p className="text-sm text-muted-foreground">
                    Monthly income: {formatCurrency(memberRow.monthly_income)}
                  </p>
                ) : customer?.monthly_income != null ? (
                  <p className="text-sm text-muted-foreground">
                    Monthly income: {formatCurrency(customer.monthly_income)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Customer details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-muted-foreground">Customer number</p>
                <p className="font-mono font-medium">
                  {memberRow?.customer_number || customer?.customer_number || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{memberRow?.phone || customer?.phone_primary || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">National ID</p>
                <p className="font-medium">{customer?.national_id || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Risk grade</p>
                {riskGrade ? (
                  <Badge variant={riskVariant[riskGrade] ?? "outline"}>{riskGrade}</Badge>
                ) : (
                  <p>—</p>
                )}
              </div>
              {memberRow ? (
                <>
                  <div>
                    <p className="text-muted-foreground">Collected (vikundi loans)</p>
                    <p className="font-medium text-emerald-700">
                      {formatCurrency(memberRow.total_collected)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Principal disbursed</p>
                    <p className="font-medium">{formatCurrency(memberRow.principal_disbursed)}</p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
