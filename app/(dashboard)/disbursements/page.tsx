"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Eye,
  FileDown,
  Wallet,
  Landmark,
  Smartphone,
  Banknote,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { exportDisbursementToPdf } from "@/lib/disbursement-pdf";
import {
  getCustomerById,
  getUserById,
  formatCurrency,
  formatDate,
  formatDateTime,
  loans,
  currentUser,
} from "@/lib/mock-data";
import {
  DISBURSEMENT_CHANNEL_LABELS,
  type Disbursement,
  type DisbursementPaymentChannel,
} from "@/lib/disbursement-types";

const STATUS_ORDER: Disbursement["status"][] = [
  "pending_approval",
  "approved",
  "completed",
  "rejected",
];

const statusConfig: Record<
  Disbursement["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending_approval: { label: "Pending approval", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const MOBILE_CHANNELS: DisbursementPaymentChannel[] = [
  "mpesa",
  "airtel_money",
  "yas",
  "halopesa",
];
const BANK_CHANNELS: DisbursementPaymentChannel[] = ["crdb", "nmb"];

type EligibleLoan = {
  id: string;
  loan_number: string;
  customer_id: string;
  principal_amount: number;
  remaining: number;
};

type Kpis = {
  pending_approval: number;
  approved: number;
  completed: number;
  rejected: number;
  mtd_completed_volume: number;
};

const CHANNEL_OPTIONS = Object.keys(DISBURSEMENT_CHANNEL_LABELS) as DisbursementPaymentChannel[];

function canActAsAdmin() {
  return currentUser.role === "super_admin";
}

function MiniSpark({ className }: { className?: string }) {
  return (
    <svg
      className={cn(
        "pointer-events-none absolute right-1.5 top-2 h-5 w-12 text-foreground/[0.07]",
        className
      )}
      viewBox="0 0 72 24"
      aria-hidden
    >
      <path
        d="M0 16 Q18 4 36 14 T72 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function DisbursementDetailPanel({
  row,
  onClose,
  onExportPdf,
}: {
  row: Disbursement;
  onClose: () => void;
  onExportPdf: (r: Disbursement) => void;
}) {
  const loan = loans.find((l) => l.id === row.loan_id);
  const customer = loan ? getCustomerById(loan.customer_id) : undefined;
  const prepared = getUserById(row.prepared_by);
  const approved = row.approved_by ? getUserById(row.approved_by) : undefined;
  const rejectedU = row.rejected_by ? getUserById(row.rejected_by) : undefined;
  const sc = statusConfig[row.status];

  return (
    <>
      <div className="relative border-b bg-gradient-to-r from-emerald-950/95 via-emerald-900 to-emerald-950 px-6 pb-6 pt-6 text-primary-foreground">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-100/90">
              Disbursement record
            </p>
            <DialogTitle className="text-left text-xl font-semibold tracking-tight text-white">
              {loan?.loan_number ?? row.loan_id}
            </DialogTitle>
            <DialogDescription className="text-left text-emerald-100/90">
              Ref <span className="font-mono text-white/95">{row.id}</span>
              {" · "}
              {customer
                ? `${customer.first_name} ${customer.last_name}`
                : "Customer unknown"}
            </DialogDescription>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge
              className="border-white/20 bg-white/15 text-white backdrop-blur-sm hover:bg-white/20"
              variant="outline"
            >
              {sc.label}
            </Badge>
            <p className="text-xs text-emerald-100/80">
              Updated {formatDateTime(row.updated_at)}
            </p>
          </div>
        </div>
        <p className="pointer-events-none absolute bottom-2 right-4 hidden rotate-[-8deg] select-none border-2 border-white/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 sm:block">
          {row.status.replace(/_/g, " ")}
        </p>
      </div>

      <div className="max-h-[55vh] overflow-y-auto overscroll-contain px-6 py-5">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Amount & channel
              </h4>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {formatCurrency(row.amount)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {DISBURSEMENT_CHANNEL_LABELS[row.method]}
              </p>
            </div>
            <Separator />
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Prepared by</dt>
                <dd className="text-right font-medium">
                  {prepared?.full_name ?? row.prepared_by}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Approved by</dt>
                <dd className="text-right font-medium">
                  {approved?.full_name ?? row.approved_by ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Rejected by</dt>
                <dd className="text-right font-medium">
                  {rejectedU?.full_name ?? row.rejected_by ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Destination & references
            </h4>
            <dl className="grid gap-2 rounded-xl border bg-muted/30 p-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Account name</dt>
                <dd className="font-medium">{row.account_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account number</dt>
                <dd className="font-mono text-sm">{row.account_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Bank</dt>
                <dd>{row.bank_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Transaction reference</dt>
                <dd className="font-mono text-sm">{row.transaction_reference ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2">
            <p className="text-[11px] uppercase text-muted-foreground">Approved</p>
            <p className="font-medium">
              {row.approved_at ? formatDateTime(row.approved_at) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2">
            <p className="text-[11px] uppercase text-muted-foreground">Disbursed</p>
            <p className="font-medium">
              {row.disbursed_at ? formatDateTime(row.disbursed_at) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2 sm:col-span-2">
            <p className="text-[11px] uppercase text-muted-foreground">Rejected</p>
            <p className="font-medium">
              {row.rejected_at ? formatDateTime(row.rejected_at) : "—"}
            </p>
            {row.rejection_reason && (
              <p className="mt-2 text-destructive">{row.rejection_reason}</p>
            )}
          </div>
        </div>

        {row.notes && (
          <>
            <Separator className="my-5" />
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{row.notes}</p>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button className="gap-2" onClick={() => onExportPdf(row)}>
          <FileDown className="h-4 w-4" />
          Export PDF
        </Button>
      </div>
    </>
  );
}

export default function DisbursementsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rows, setRows] = useState<Disbursement[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [eligibleLoans, setEligibleLoans] = useState<EligibleLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [formLoan, setFormLoan] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState<DisbursementPaymentChannel>("mpesa");
  const [formAccountName, setFormAccountName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formBankName, setFormBankName] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [viewRow, setViewRow] = useState<Disbursement | null>(null);
  const [completeRow, setCompleteRow] = useState<Disbursement | null>(null);
  const [completeRef, setCompleteRef] = useState("");
  const [rejectRow, setRejectRow] = useState<Disbursement | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/disbursements?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load disbursements");
      const data = await res.json();
      setRows(data.disbursements ?? []);
      setKpis(data.kpis ?? null);
      setEligibleLoans(data.eligible_loans ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedEligible = useMemo(
    () => eligibleLoans.find((l) => l.id === formLoan),
    [eligibleLoans, formLoan]
  );

  const handleCreate = async () => {
    if (!selectedEligible) return;
    const amount = Number(formAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const body: Record<string, unknown> = {
      loan_id: formLoan,
      amount,
      method: formMethod,
      notes: formNotes || undefined,
    };
    if (MOBILE_CHANNELS.includes(formMethod) || BANK_CHANNELS.includes(formMethod)) {
      if (formAccountName) body.account_name = formAccountName;
      if (formAccountNumber) body.account_number = formAccountNumber;
    }
    if (BANK_CHANNELS.includes(formMethod) && formBankName) body.bank_name = formBankName;
    if (BANK_CHANNELS.includes(formMethod) && !formBankName) {
      body.bank_name = DISBURSEMENT_CHANNEL_LABELS[formMethod];
    }

    setActionLoading("create");
    try {
      const res = await fetch("/api/disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Create failed");
        return;
      }
      setCreateOpen(false);
      setFormLoan("");
      setFormAmount("");
      setFormNotes("");
      setFormAccountName("");
      setFormAccountNumber("");
      setFormBankName("");
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const patch = async (id: string, body: object) => {
    setActionLoading(id);
    setError(null);
    try {
      const res = await fetch(`/api/disbursements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setCompleteRow(null);
      setRejectRow(null);
      setCompleteRef("");
      setRejectReason("");
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const admin = canActAsAdmin();

  const chartData = useMemo(() => {
    if (!kpis) return [];
    return [
      { name: "Pending", short: "Pend.", count: kpis.pending_approval, fill: "#ea580c" },
      { name: "Approved", short: "Appr.", count: kpis.approved, fill: "#0284c7" },
      { name: "Completed", short: "Done", count: kpis.completed, fill: "#059669" },
      { name: "Rejected", short: "Rej.", count: kpis.rejected, fill: "#e11d48" },
    ];
  }, [kpis]);

  const totalRecords = useMemo(() => {
    if (!kpis) return 0;
    return (
      kpis.pending_approval + kpis.approved + kpis.completed + kpis.rejected
    );
  }, [kpis]);

  const shareOfTotal = (n: number) =>
    totalRecords > 0 ? Math.round((n / totalRecords) * 100) : 0;

  /** Compact ops insight — same footprint as previous subtitle line */
  const workflowInsight = useMemo(() => {
    if (!kpis || totalRecords === 0) {
      return "No disbursements yet — analysis appears when records exist.";
    }
    const inFlight = kpis.pending_approval + kpis.approved;
    const settledRate = Math.round((kpis.completed / totalRecords) * 100);
    const declinedRate = Math.round((kpis.rejected / totalRecords) * 100);
    return `Ledger ${totalRecords} · In workflow ${inFlight} · Settled ${settledRate}% · Declined ${declinedRate}%`;
  }, [kpis, totalRecords]);

  const createAmountNum = Number(formAmount);
  const createAmountInvalid =
    !!selectedEligible &&
    formAmount !== "" &&
    (!Number.isFinite(createAmountNum) ||
      createAmountNum <= 0 ||
      createAmountNum > selectedEligible.remaining);

  const handleExportPdf = useCallback((row: Disbursement) => {
    const loan = loans.find((l) => l.id === row.loan_id);
    const customer = loan ? getCustomerById(loan.customer_id) : undefined;
    const customerName = customer
      ? `${customer.first_name} ${customer.last_name}`
      : "—";
    exportDisbursementToPdf({
      disbursement: row,
      loanNumber: loan?.loan_number ?? row.loan_id,
      customerName,
      channelLabel: DISBURSEMENT_CHANNEL_LABELS[row.method],
      preparedByName: getUserById(row.prepared_by)?.full_name ?? row.prepared_by,
      approvedByName: row.approved_by
        ? getUserById(row.approved_by)?.full_name ?? row.approved_by
        : null,
      rejectedByName: row.rejected_by
        ? getUserById(row.rejected_by)?.full_name ?? row.rejected_by
        : null,
    });
  }, []);

  return (
    <>
      <DashboardHeader
        title="Loan disbursement"
        description="Prepare, approve, and record releases of approved principal to customers"
      />
      <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 lg:p-6 lg:pb-8">
        <div className="mx-auto w-full max-w-7xl space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Summary: compact chart + side KPIs */}
          <section
            aria-label="Disbursement summary"
            className="flex flex-col-reverse gap-2 lg:flex-row lg:items-start lg:gap-3"
          >
            <Card className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-border/60 py-0 shadow-sm">
              <CardHeader className="space-y-0.5 px-4 pb-1 pt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <CardTitle className="text-sm font-semibold tracking-tight">
                    Workflow mix
                  </CardTitle>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    Pend. · Appr. · Done · Rej.
                  </span>
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  {workflowInsight}
                </p>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="h-[112px] w-full sm:h-[120px] lg:h-[128px]">
                  {loading || !kpis ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin opacity-50" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 12, right: 6, left: 2, bottom: 2 }}
                        barCategoryGap="14%"
                      >
                        <CartesianGrid
                          strokeDasharray="4 4"
                          vertical={false}
                          stroke="hsl(var(--border))"
                          strokeOpacity={0.85}
                        />
                        <XAxis
                          dataKey="short"
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis
                          hide
                          domain={[0, (max: number) => Math.max(Math.ceil(max * 1.25), 1)]}
                        />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted) / 0.25)" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0].payload as (typeof chartData)[0];
                            const pct =
                              totalRecords > 0
                                ? Math.round((p.count / totalRecords) * 100)
                                : 0;
                            return (
                              <div className="min-w-[9rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                                <p className="border-b border-border pb-1 font-semibold text-foreground">
                                  {p.name}
                                </p>
                                <p className="mt-1 tabular-nums text-muted-foreground">
                                  <span className="font-medium text-foreground">{p.count}</span>
                                  {" "}request{p.count === 1 ? "" : "s"}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {pct}% of active ledger
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={34}>
                          <LabelList
                            dataKey="count"
                            position="top"
                            fill="hsl(var(--foreground))"
                            fontSize={9}
                            formatter={(v: number | string) =>
                              Number(v) > 0 ? String(v) : ""
                            }
                            offset={2}
                          />
                          {chartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[232px] xl:w-[248px]">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative overflow-hidden rounded-lg border border-amber-200/60 bg-gradient-to-br from-amber-50/95 to-background px-2 py-2 shadow-sm">
                  <MiniSpark className="text-amber-600/18" />
                  <p className="relative text-[9px] font-semibold uppercase tracking-wide text-amber-900/75">
                    Pending
                  </p>
                  <p className="relative mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight">
                    {kpis ? kpis.pending_approval : "—"}
                  </p>
                  <p className="relative mt-0.5 truncate text-[10px] text-muted-foreground">
                    {totalRecords ? `${shareOfTotal(kpis?.pending_approval ?? 0)}%` : "\u00a0"}
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-lg border border-sky-200/60 bg-gradient-to-br from-sky-50/95 to-background px-2 py-2 shadow-sm">
                  <MiniSpark className="text-sky-600/18" />
                  <p className="relative text-[9px] font-semibold uppercase tracking-wide text-sky-900/75">
                    Approved
                  </p>
                  <p className="relative mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight">
                    {kpis ? kpis.approved : "—"}
                  </p>
                  <p className="relative mt-0.5 truncate text-[10px] text-muted-foreground">
                    {totalRecords ? `${shareOfTotal(kpis?.approved ?? 0)}%` : "\u00a0"}
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-lg border border-emerald-200/60 bg-gradient-to-br from-emerald-50/95 to-background px-2 py-2 shadow-sm">
                  <MiniSpark className="text-emerald-600/18" />
                  <p className="relative text-[9px] font-semibold uppercase tracking-wide text-emerald-900/75">
                    Completed
                  </p>
                  <p className="relative mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight">
                    {kpis ? kpis.completed : "—"}
                  </p>
                  <p className="relative mt-0.5 truncate text-[10px] text-muted-foreground">
                    {totalRecords ? `${shareOfTotal(kpis?.completed ?? 0)}%` : "\u00a0"}
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-lg border border-rose-200/60 bg-gradient-to-br from-rose-50/95 to-background px-2 py-2 shadow-sm">
                  <MiniSpark className="text-rose-600/18" />
                  <p className="relative text-[9px] font-semibold uppercase tracking-wide text-rose-900/75">
                    Rejected
                  </p>
                  <p className="relative mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight">
                    {kpis ? kpis.rejected : "—"}
                  </p>
                  <p className="relative mt-0.5 truncate text-[10px] text-muted-foreground">
                    {totalRecords ? `${shareOfTotal(kpis?.rejected ?? 0)}%` : "\u00a0"}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-background px-2.5 py-2 shadow-sm">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-900/75">
                  MTD completed
                </p>
                <p className="mt-0.5 truncate text-base font-bold tabular-nums leading-tight text-emerald-950">
                  {kpis ? formatCurrency(kpis.mtd_completed_volume) : "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-emerald-900/55">Mock ledger</p>
              </div>
            </div>
          </section>

          {/* Toolbar */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search loan number or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_ORDER.map((st) => (
                    <SelectItem key={st} value={st}>
                      {statusConfig[st].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => load()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                <span className="ml-2">Refresh</span>
              </Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={eligibleLoans.length === 0}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create disbursement
                  </Button>
                </DialogTrigger>
                <DialogContent className="gap-0 overflow-hidden border-border/60 p-0 shadow-xl sm:max-w-[480px]">
                  <div className="relative border-b bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 px-5 pb-5 pt-5 text-primary-foreground">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                        <Sparkles className="h-5 w-5 text-emerald-100" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/90">
                          New request
                        </p>
                        <DialogTitle className="text-left text-lg font-semibold leading-tight tracking-tight text-white">
                          Create disbursement
                        </DialogTitle>
                        <DialogDescription className="text-left text-[13px] leading-snug text-emerald-100/90">
                          Submit for approval. Amount cannot exceed the remaining approved principal for the loan.
                        </DialogDescription>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[min(65vh,520px)] overflow-y-auto overscroll-contain px-5 py-4">
                    {eligibleLoans.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                        <Wallet className="mx-auto h-8 w-8 text-muted-foreground/60" />
                        <p className="mt-3 text-sm font-medium text-foreground">No eligible loans</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Loans in <span className="font-medium">pending disbursement</span> with available principal appear here.
                        </p>
                      </div>
                    ) : (
                      <FieldGroup className="gap-0">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <Wallet className="h-3.5 w-3.5 text-emerald-700" />
                            1. Loan & amount
                          </div>
                          <Field>
                            <FieldLabel className="text-xs font-medium">Loan</FieldLabel>
                            <Select value={formLoan} onValueChange={setFormLoan}>
                              <SelectTrigger className="h-11 bg-background">
                                <SelectValue placeholder="Select loan" />
                              </SelectTrigger>
                              <SelectContent>
                                {eligibleLoans.map((l) => {
                                  const c = getCustomerById(l.customer_id);
                                  return (
                                    <SelectItem key={l.id} value={l.id}>
                                      <span className="font-medium">{l.loan_number}</span>
                                      <span className="text-muted-foreground">
                                        {" "}
                                        · {c?.first_name} {c?.last_name}
                                      </span>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {selectedEligible && (
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-xs dark:bg-emerald-950/20">
                                <span className="text-muted-foreground">Remaining principal bucket</span>
                                <span className="font-mono font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
                                  {formatCurrency(selectedEligible.remaining)}
                                </span>
                              </div>
                            )}
                          </Field>
                          <Field>
                            <FieldLabel className="text-xs font-medium">Amount (TZS)</FieldLabel>
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                TZS
                              </span>
                              <Input
                                type="number"
                                min={1}
                                max={selectedEligible?.remaining}
                                value={formAmount}
                                onChange={(e) => setFormAmount(e.target.value)}
                                placeholder="0"
                                className={cn(
                                  "h-11 pl-12 font-mono tabular-nums",
                                  createAmountInvalid && "border-destructive focus-visible:ring-destructive"
                                )}
                              />
                            </div>
                            {createAmountInvalid && selectedEligible && (
                              <p className="mt-1.5 text-xs text-destructive">
                                Enter a positive amount up to {formatCurrency(selectedEligible.remaining)}.
                              </p>
                            )}
                          </Field>
                        </div>

                        <Separator className="my-5" />

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                            2. Payout channel
                          </div>
                          <Field>
                            <FieldLabel className="text-xs font-medium">Payment method</FieldLabel>
                            <Select
                              value={formMethod}
                              onValueChange={(v) => setFormMethod(v as DisbursementPaymentChannel)}
                            >
                              <SelectTrigger className="h-11 bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-[280px]">
                                {CHANNEL_OPTIONS.map((ch) => (
                                  <SelectItem key={ch} value={ch}>
                                    {DISBURSEMENT_CHANNEL_LABELS[ch]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                              {MOBILE_CHANNELS.includes(formMethod) &&
                                "Mobile money — capture wallet name and MSISDN."}
                              {BANK_CHANNELS.includes(formMethod) &&
                                "Bank transfer — beneficiary name and account number."}
                              {formMethod === "cash" && "Cash payout — optional payee details in notes."}
                              {formMethod === "other" && "Other channel — describe details in notes if needed."}
                            </p>
                          </Field>
                        </div>

                        {(MOBILE_CHANNELS.includes(formMethod) || BANK_CHANNELS.includes(formMethod)) && (
                          <>
                            <Separator className="my-5" />
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {MOBILE_CHANNELS.includes(formMethod) ? (
                                  <Smartphone className="h-3.5 w-3.5 text-emerald-700" />
                                ) : (
                                  <Landmark className="h-3.5 w-3.5 text-emerald-700" />
                                )}
                                3. Beneficiary details
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <Field className="sm:col-span-2">
                                  <FieldLabel className="text-xs font-medium">Account / payee name</FieldLabel>
                                  <Input
                                    value={formAccountName}
                                    onChange={(e) => setFormAccountName(e.target.value)}
                                    placeholder="As registered with operator or bank"
                                    className="h-11"
                                  />
                                </Field>
                                <Field className="sm:col-span-2">
                                  <FieldLabel className="text-xs font-medium">
                                    {MOBILE_CHANNELS.includes(formMethod)
                                      ? "Phone number (MSISDN)"
                                      : "Account number"}
                                  </FieldLabel>
                                  <Input
                                    value={formAccountNumber}
                                    onChange={(e) => setFormAccountNumber(e.target.value)}
                                    placeholder={
                                      MOBILE_CHANNELS.includes(formMethod) ? "+255 …" : "Account no."
                                    }
                                    className="h-11 font-mono"
                                  />
                                </Field>
                              </div>
                              {BANK_CHANNELS.includes(formMethod) && (
                                <Field>
                                  <FieldLabel className="text-xs font-medium">Bank name</FieldLabel>
                                  <Input
                                    value={formBankName}
                                    onChange={(e) => setFormBankName(e.target.value)}
                                    placeholder={DISBURSEMENT_CHANNEL_LABELS[formMethod]}
                                    className="h-11"
                                  />
                                </Field>
                              )}
                            </div>
                          </>
                        )}

                        <Separator className="my-5" />

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <FileText className="h-3.5 w-3.5 text-emerald-700" />
                            {MOBILE_CHANNELS.includes(formMethod) || BANK_CHANNELS.includes(formMethod)
                              ? "4. Internal notes"
                              : "3. Internal notes"}
                          </div>
                          <Field>
                            <FieldLabel className="sr-only">Notes</FieldLabel>
                            <Textarea
                              value={formNotes}
                              onChange={(e) => setFormNotes(e.target.value)}
                              rows={3}
                              placeholder="Optional context for approvers (branch, tranche, etc.)"
                              className="min-h-[80px] resize-none bg-muted/30"
                            />
                          </Field>
                        </div>
                      </FieldGroup>
                    )}
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-border/60 bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:min-w-[100px]"
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="gap-2 sm:min-w-[160px]"
                      onClick={handleCreate}
                      disabled={
                        eligibleLoans.length === 0 ||
                        !selectedEligible ||
                        actionLoading === "create" ||
                        !formAmount ||
                        createAmountInvalid
                      }
                    >
                      {actionLoading === "create" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Submit for approval
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prepared by</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          No disbursements match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => {
                        const loan = loans.find((l) => l.id === row.loan_id);
                        const customer = loan ? getCustomerById(loan.customer_id) : undefined;
                        const prepared = getUserById(row.prepared_by);
                        const sc = statusConfig[row.status];
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">
                              <Link className="text-primary hover:underline" href="/loans">
                                {loan?.loan_number ?? row.loan_id}
                              </Link>
                            </TableCell>
                            <TableCell>
                              {customer ? `${customer.first_name} ${customer.last_name}` : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(row.amount)}
                            </TableCell>
                            <TableCell>{DISBURSEMENT_CHANNEL_LABELS[row.method]}</TableCell>
                            <TableCell>
                              <Badge variant={sc.variant}>{sc.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{prepared?.full_name ?? row.prepared_by}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <div className="space-y-0.5">
                                {row.approved_at && <div>Approved {formatDate(row.approved_at)}</div>}
                                {row.rejected_at && <div>Rejected {formatDate(row.rejected_at)}</div>}
                                {row.disbursed_at && <div>Disbursed {formatDateTime(row.disbursed_at)}</div>}
                                {!row.approved_at && !row.rejected_at && !row.disbursed_at && "—"}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setViewRow(row)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {admin && row.status === "pending_approval" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={actionLoading === row.id}
                                      onClick={() => patch(row.id, { action: "approve" })}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={actionLoading === row.id}
                                      onClick={() => {
                                        setRejectRow(row);
                                        setRejectReason("");
                                      }}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {admin && row.status === "approved" && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setCompleteRow(row);
                                      setCompleteRef(row.transaction_reference ?? "");
                                    }}
                                    disabled={actionLoading === row.id}
                                  >
                                    Complete
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {loading ? (
              <div className="flex justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No disbursements match your filters.
              </p>
            ) : (
              rows.map((row) => {
                const loan = loans.find((l) => l.id === row.loan_id);
                const customer = loan ? getCustomerById(loan.customer_id) : undefined;
                const prepared = getUserById(row.prepared_by);
                const sc = statusConfig[row.status];
                return (
                  <Card key={row.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{loan?.loan_number ?? row.loan_id}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {customer ? `${customer.first_name} ${customer.last_name}` : "—"}
                          </p>
                        </div>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-semibold">{formatCurrency(row.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Channel</span>
                        <span>{DISBURSEMENT_CHANNEL_LABELS[row.method]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prepared by</span>
                        <span>{prepared?.full_name ?? row.prepared_by}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewRow(row)}>
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>
                        {admin && row.status === "pending_approval" && (
                          <>
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={actionLoading === row.id}
                              onClick={() => patch(row.id, { action: "approve" })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              disabled={actionLoading === row.id}
                              onClick={() => {
                                setRejectRow(row);
                                setRejectReason("");
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {admin && row.status === "approved" && (
                          <Button
                            size="sm"
                            className="flex-1"
                            disabled={actionLoading === row.id}
                            onClick={() => {
                              setCompleteRow(row);
                              setCompleteRef(row.transaction_reference ?? "");
                            }}
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </main>

      <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
        <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {viewRow ? (
            <DisbursementDetailPanel
              row={viewRow}
              onClose={() => setViewRow(null)}
              onExportPdf={handleExportPdf}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeRow} onOpenChange={(o) => !o && setCompleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark disbursed</DialogTitle>
            <DialogDescription>
              Record completion and optional bank / MNO reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="cref">Transaction reference</Label>
              <Input
                id="cref"
                value={completeRef}
                onChange={(e) => setCompleteRef(e.target.value)}
                placeholder="e.g. FT-123456"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteRow(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                completeRow &&
                patch(completeRow.id, {
                  action: "complete",
                  transaction_reference: completeRef || null,
                })
              }
              disabled={!completeRow || actionLoading === completeRow?.id}
            >
              Confirm complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectRow} onOpenChange={(o) => !o && setRejectRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject disbursement</DialogTitle>
            <DialogDescription>Optional reason (visible on the record).</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectRow &&
                patch(rejectRow.id, { action: "reject", rejection_reason: rejectReason || null })
              }
              disabled={!rejectRow || actionLoading === rejectRow?.id}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
