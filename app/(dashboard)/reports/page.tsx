"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
 AlertTriangle,
 ArrowDownRight,
 ArrowUpRight,
 BarChart3,
 Calendar,
 Download,
 Loader2,
 PieChart,
 TrendingUp,
} from "lucide-react";
import {
 Area,
 AreaChart,
 Bar,
 BarChart,
 CartesianGrid,
 Cell,
 Legend,
 Pie,
 PieChart as RechartsPieChart,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from "recharts";
import { DashboardHeader } from "@/components/dashboard-header";
import { useOptionalBranchAssignment } from "@/components/branch-assignment-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { exportBranchReportPdf } from "@/lib/branch-report-pdf";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { normalizePortfolioSummary, type PortfolioSummaryView } from "@/lib/portfolio-summary";
import { agingColor, normalizeAgingReport, type AgingReportView } from "@/lib/reports-aging";
import {
 getPeriodRange,
 mergeMonthlyActivity,
 normalizeTimeseries,
 type MonthlyActivityRow,
} from "@/lib/reports-timeseries";
import { isBranchScopedStaffRole } from "@/lib/role-portal";
import { useSessionUser } from "@/lib/use-session-user";

function formatYAxis(value: number) {
 if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
 if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
 return value.toString();
}

function todayInputDate(): string {
 return new Date().toISOString().slice(0, 10);
}

function safeRate(value: unknown): number {
 const n = Number(value);
 return Number.isFinite(n) ? n : 0;
}

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
 const res = await fetch(url, { credentials: "include" });
 const json = (await res.json()) as unknown;
 if (!res.ok) {
 const message =
 typeof json === "object" &&
 json !== null &&
 "message" in json &&
 typeof (json as { message: unknown }).message === "string"
 ? (json as { message: string }).message
 : "Request failed";
 return { ok: false, message };
 }
 return { ok: true, data: json as T };
}

export default function ReportsPage() {
 const { user, loaded: sessionLoaded } = useSessionUser();
 const branchCtx = useOptionalBranchAssignment();
 const branches = branchCtx?.branches ?? [];
 const isSuperAdmin = user?.role === "super_admin";
 const isOfficerView = user?.role === "loan_officer";
 const isManagerView = user?.role === "branch_manager";
 const isScopedRole = isBranchScopedStaffRole(user?.role);
 const scopedBranchId = isScopedRole && user?.branch_id?.trim() ? user.branch_id.trim() : null;

 const [period, setPeriod] = useState("6m");
 const [startDateFilter, setStartDateFilter] = useState("");
 const [endDateFilter, setEndDateFilter] = useState("");
 const [branchFilter, setBranchFilter] = useState("all");
 const [exportOption, setExportOption] = useState<"pdf" | "csv" | "json">("pdf");

 const [portfolio, setPortfolio] = useState<PortfolioSummaryView | null>(null);
 const [aging, setAging] = useState<AgingReportView | null>(null);
 const [monthlyData, setMonthlyData] = useState<MonthlyActivityRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [exporting, setExporting] = useState(false);

 const effectiveBranchId = scopedBranchId ?? (branchFilter !== "all" ? branchFilter : undefined);
 const range = useMemo(
 () => getPeriodRange(period, startDateFilter || undefined, endDateFilter || undefined),
 [period, startDateFilter, endDateFilter]
 );

 const scopeLabel = useMemo(() => {
 if (isOfficerView) {
 const name = branches.find((b) => b.id === scopedBranchId)?.name;
 return name ? `${name} · your portfolio` : "Your assigned portfolio";
 }
 if (scopedBranchId) {
 return branches.find((b) => b.id === scopedBranchId)?.name ?? "Your branch";
 }
 if (effectiveBranchId) {
 return branches.find((b) => b.id === effectiveBranchId)?.name ?? effectiveBranchId;
 }
 return "All branches";
 }, [scopedBranchId, effectiveBranchId, branches, isOfficerView]);

 const loadReports = useCallback(async () => {
 setLoading(true);
 setError(null);

 const asOf = endDateFilter || todayInputDate();
 const branchQ = effectiveBranchId ? `&branch_id=${encodeURIComponent(effectiveBranchId)}` : "";
 const rangeQ = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;

 try {
 const [portfolioRes, agingRes, disbRes, collRes, outRes] = await Promise.all([
 fetchJson<unknown>(`/api/reports/portfolio-summary?as_of=${asOf}${branchQ}`),
 fetchJson<unknown>(`/api/reports/aging?as_of=${asOf}${branchQ}`),
 fetchJson<unknown>(
 `/api/falco/dashboard/timeseries?metric=disbursements&${rangeQ}${branchQ ? `&${branchQ.slice(1)}` : ""}`
 ),
 fetchJson<unknown>(
 `/api/falco/dashboard/timeseries?metric=collections&${rangeQ}${branchQ ? `&${branchQ.slice(1)}` : ""}`
 ),
 fetchJson<unknown>(
 `/api/falco/dashboard/timeseries?metric=outstanding&${rangeQ}${branchQ ? `&${branchQ.slice(1)}` : ""}`
 ),
 ]);

 if (!portfolioRes.ok) {
 setError(portfolioRes.message);
 setPortfolio(null);
 setAging(null);
 setMonthlyData([]);
 return;
 }

 setPortfolio(normalizePortfolioSummary(portfolioRes.data));
 setAging(agingRes.ok ? normalizeAgingReport(agingRes.data) : { rows: [], totalOutstanding: 0, totalProvision: 0 });

 const disbursements = disbRes.ok ? normalizeTimeseries(disbRes.data) : [];
 const collections = collRes.ok ? normalizeTimeseries(collRes.data) : [];
 const outstanding = outRes.ok ? normalizeTimeseries(outRes.data) : [];
 setMonthlyData(mergeMonthlyActivity({ disbursements, collections, outstanding }));

 if (!agingRes.ok) {
 setError((prev) => prev ?? agingRes.message);
 }
 } catch {
 setError("Could not load reports. Check your connection and try again.");
 setPortfolio(null);
 setAging(null);
 setMonthlyData([]);
 } finally {
 setLoading(false);
 }
 }, [effectiveBranchId, endDateFilter, range.from, range.to]);

 useEffect(() => {
 if (!sessionLoaded) return;
 if (isScopedRole && !scopedBranchId) {
 setError("Your account is not linked to a branch. Contact an administrator.");
 setLoading(false);
 return;
 }
 void loadReports();
 }, [loadReports, sessionLoaded, isScopedRole, scopedBranchId]);

 const metrics = portfolio?.metrics;
 const productPerformance = portfolio?.byProduct ?? [];
 const branchPerformance = portfolio?.byBranch ?? [];
 const agingRows = aging?.rows ?? [];

 const branchPerformanceDisplay = useMemo(() => {
 if (branchPerformance.length) {
 if (scopedBranchId) {
 return branchPerformance.filter((b) => b.branchId === scopedBranchId);
 }
 return branchPerformance;
 }
 if (scopedBranchId && metrics) {
 return [
 {
 branchId: scopedBranchId,
 name: scopeLabel,
 code: "",
 loanCount: metrics.activeLoans,
 outstanding: metrics.totalPortfolio,
 disbursed: 0,
 collected: 0,
 collectionRate: 0,
 },
 ];
 }
 return [];
 }, [branchPerformance, scopedBranchId, metrics, scopeLabel]);

 const portfolioMoM = useMemo(() => {
 if (monthlyData.length < 2) return null;
 const prev = monthlyData[monthlyData.length - 2]?.outstanding ?? 0;
 const curr = monthlyData[monthlyData.length - 1]?.outstanding ?? metrics?.totalPortfolio ?? 0;
 if (prev <= 0) return null;
 return ((curr - prev) / prev) * 100;
 }, [monthlyData, metrics?.totalPortfolio]);

 const growthChartData = useMemo(
 () =>
 monthlyData.map((row) => ({
 month: row.month,
 portfolio: row.outstanding > 0 ? row.outstanding : row.disbursements,
 })),
 [monthlyData]
 );

 const exportReport = async () => {
 if (!portfolio || !metrics) return;
 setExporting(true);
 try {
 const payload = {
 branchName: scopeLabel,
 periodLabel: range.label,
 generatedAt: formatDateTime(new Date().toISOString()),
 summary: {
 totalPortfolio: metrics.totalPortfolio,
 totalPar: metrics.parAmount,
 parRatio: metrics.parRate,
 nplRatio: metrics.nplRate,
 requiredProvision: metrics.requiredProvision,
 },
 productPerformance: productPerformance.map((p) => ({
 name: p.name,
 loanCount: p.loanCount,
 outstanding: p.outstanding,
 par: p.par,
 parRate: p.parRate,
 })),
 agingReport: agingRows.map((row) => ({
 classificationLabel: row.label,
 outstanding: row.outstandingAmount,
 provision: row.provisionAmount,
 rate: row.provisionRate,
 })),
 branchPerformance: branchPerformanceDisplay.map((b) => ({
 name: b.name,
 loanCount: b.loanCount,
 disbursed: b.disbursed,
 collected: b.collected,
 outstanding: b.outstanding,
 collectionRate: b.collectionRate,
 })),
 applications: [],
 customers: [],
 loans: [],
 collections: [],
 };

 if (exportOption === "json") {
 const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = `reports-${todayInputDate()}.json`;
 anchor.click();
 URL.revokeObjectURL(url);
 return;
 }

 if (exportOption === "csv") {
 const params = new URLSearchParams({ format: "csv", as_of: endDateFilter || todayInputDate() });
 if (effectiveBranchId) params.set("branch_id", effectiveBranchId);
 const res = await fetch(`/api/reports/portfolio-summary/export?${params.toString()}`, {
 credentials: "include",
 });
 if (!res.ok) {
 const json = (await res.json()) as { message?: string };
 throw new Error(json.message ?? "CSV export failed");
 }
 const blob = await res.blob();
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = `reports-${todayInputDate()}.csv`;
 anchor.click();
 URL.revokeObjectURL(url);
 return;
 }

 exportBranchReportPdf(payload);
 } catch (e) {
 setError(e instanceof Error ? e.message : "Export failed");
 } finally {
 setExporting(false);
 }
 };

 return (
 <>
 <DashboardHeader
 title="Reports"
 description={
 isOfficerView
 ? "Portfolio analysis for customers assigned to you in your branch"
 : scopedBranchId
 ? `Portfolio analysis for ${scopeLabel}`
 : "Portfolio analysis and regulatory reports"
 }
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 {scopedBranchId ? (
 <div className="flex flex-wrap items-center gap-2">
 <Badge variant="secondary">
 {isOfficerView ? "Portfolio scope" : "Branch scope"}: {scopeLabel}
 </Badge>
 <span className="text-sm text-muted-foreground">
 {isOfficerView
 ? "Metrics built from your assigned customers’ loans"
 : "Live data from your assigned branch"}
 </span>
 </div>
 ) : null}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-wrap items-center gap-3">
 <Select value={period} onValueChange={setPeriod}>
 <SelectTrigger className="w-36">
 <Calendar className="mr-2 h-4 w-4" />
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="1m">Last Month</SelectItem>
 <SelectItem value="3m">Last 3 Months</SelectItem>
 <SelectItem value="6m">Last 6 Months</SelectItem>
 <SelectItem value="1y">Last Year</SelectItem>
 </SelectContent>
 </Select>
 <Input
 type="date"
 value={startDateFilter}
 onChange={(e) => setStartDateFilter(e.target.value)}
 className="w-[170px]"
 />
 <Input
 type="date"
 value={endDateFilter}
 onChange={(e) => setEndDateFilter(e.target.value)}
 className="w-[170px]"
 />
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 setStartDateFilter("");
 setEndDateFilter("");
 }}
 >
 Clear Dates
 </Button>
 {isSuperAdmin ? (
 <Select value={branchFilter} onValueChange={setBranchFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder="All branches" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All branches</SelectItem>
 {branches.map((branch) => (
 <SelectItem key={branch.id} value={branch.id}>
 {branch.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 ) : null}
 </div>
 <div className="flex items-center gap-2">
 <Select value={exportOption} onValueChange={(v) => setExportOption(v as "pdf" | "csv" | "json")}>
 <SelectTrigger className="w-[130px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pdf">PDF</SelectItem>
 <SelectItem value="csv">CSV</SelectItem>
 <SelectItem value="json">JSON</SelectItem>
 </SelectContent>
 </Select>
 <Button variant="outline" onClick={() => void exportReport()} disabled={exporting || !portfolio}>
 {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
 Export Report
 </Button>
 </div>
 </div>

 {error ? (
 <Card className="border-destructive/40 bg-destructive/5">
 <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
 </Card>
 ) : null}

 {loading && !portfolio ? (
 <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading reports…
 </div>
 ) : null}

 {metrics ? (
 <>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Total Portfolio</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{formatCurrency(metrics.totalPortfolio)}</p>
 {portfolioMoM !== null ? (
 <div className="flex items-center gap-1 text-sm">
 {portfolioMoM >= 0 ? (
 <ArrowUpRight className="h-4 w-4 text-accent" />
 ) : (
 <ArrowDownRight className="h-4 w-4 text-destructive" />
 )}
 <span className={portfolioMoM >= 0 ? "text-accent" : "text-destructive"}>
 {portfolioMoM >= 0 ? "+" : ""}
 {portfolioMoM.toFixed(1)}%
 </span>
 <span className="text-muted-foreground">vs prior month (live)</span>
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">{metrics.activeLoans} active loans</p>
 )}
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Portfolio at Risk ({">"}30d)
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-destructive">{formatCurrency(metrics.parAmount)}</div>
 <div className="flex items-center gap-1 text-sm">
 <ArrowDownRight className="h-4 w-4 text-destructive" />
 <span className="text-destructive">{safeRate(metrics.parRate).toFixed(1)}%</span>
 <span className="text-muted-foreground">PAR ratio</span>
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">NPL Ratio</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{safeRate(metrics.nplRate).toFixed(1)}%</div>
 <p className="text-sm text-muted-foreground">Non-performing loans</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Required Provision</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-warning">
 {formatCurrency(metrics.requiredProvision || aging?.totalProvision || 0)}
 </div>
 <p className="text-sm text-muted-foreground">Per BOT guidelines</p>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="portfolio" className="space-y-4">
 <TabsList>
 <TabsTrigger value="portfolio" className="gap-2">
 <TrendingUp className="h-4 w-4" />
 Portfolio
 </TabsTrigger>
 <TabsTrigger value="aging" className="gap-2">
 <AlertTriangle className="h-4 w-4" />
 Aging Analysis
 </TabsTrigger>
 <TabsTrigger value="products" className="gap-2">
 <PieChart className="h-4 w-4" />
 Products
 </TabsTrigger>
 <TabsTrigger value="branches" className="gap-2">
 <BarChart3 className="h-4 w-4" />
 Branches
 </TabsTrigger>
 </TabsList>

 <TabsContent value="portfolio" className="space-y-6">
 <div className="grid gap-6 lg:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle>Disbursements vs Collections</CardTitle>
 <CardDescription>Monthly comparison — live dashboard timeseries</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-[300px]">
 {monthlyData.length ? (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={monthlyData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
 <XAxis dataKey="month" />
 <YAxis tickFormatter={formatYAxis} />
 <Tooltip
 formatter={(value: number) => formatCurrency(value)}
 contentStyle={{
 backgroundColor: "hsl(var(--card))",
 border: "1px solid hsl(var(--border))",
 }}
 />
 <Legend />
 <Bar
 dataKey="disbursements"
 name="Disbursements"
 fill="hsl(var(--primary))"
 radius={[4, 4, 0, 0]}
 />
 <Bar
 dataKey="collections"
 name="Collections"
 fill="hsl(var(--accent))"
 radius={[4, 4, 0, 0]}
 />
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
 No timeseries data for this period.
 </p>
 )}
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Portfolio Growth</CardTitle>
 <CardDescription>Outstanding balance trend</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-[300px]">
 {growthChartData.length ? (
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={growthChartData}>
 <defs>
 <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
 <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
 <XAxis dataKey="month" />
 <YAxis tickFormatter={formatYAxis} />
 <Tooltip
 formatter={(value: number) => formatCurrency(value)}
 contentStyle={{
 backgroundColor: "hsl(var(--card))",
 border: "1px solid hsl(var(--border))",
 }}
 />
 <Area
 type="monotone"
 dataKey="portfolio"
 name="Portfolio"
 stroke="hsl(var(--primary))"
 fill="url(#portfolioGrad)"
 strokeWidth={2}
 />
 </AreaChart>
 </ResponsiveContainer>
 ) : (
 <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
 No outstanding trend for this period.
 </p>
 )}
 </div>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle>Loan Activity Summary</CardTitle>
 <CardDescription>Monthly disbursements, collections, and loan counts from live data</CardDescription>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Month</TableHead>
 <TableHead className="text-right">Disbursements</TableHead>
 <TableHead className="text-right">Collections</TableHead>
 <TableHead className="text-right">New Loans</TableHead>
 <TableHead className="text-right">Closed Loans</TableHead>
 <TableHead className="text-right">Net Growth</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {monthlyData.length ? (
 monthlyData.map((month) => (
 <TableRow key={month.month}>
 <TableCell className="font-medium">{month.month}</TableCell>
 <TableCell className="text-right">{formatCurrency(month.disbursements)}</TableCell>
 <TableCell className="text-right">{formatCurrency(month.collections)}</TableCell>
 <TableCell className="text-right">{month.newLoans}</TableCell>
 <TableCell className="text-right">{month.closedLoans}</TableCell>
 <TableCell className="text-right">
 <span
 className={
 month.newLoans - month.closedLoans >= 0 ? "text-accent" : "text-destructive"
 }
 >
 {month.newLoans - month.closedLoans >= 0 ? "+" : ""}
 {month.newLoans - month.closedLoans}
 </span>
 </TableCell>
 </TableRow>
 ))
 ) : (
 <TableRow>
 <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
 No monthly activity for the selected range.
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="aging" className="space-y-6">
 <div className="grid gap-6 lg:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle>Portfolio Aging (BOT Classification)</CardTitle>
 <CardDescription>Live aging buckets from the reports API</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-[300px]">
 {agingRows.some((a) => a.outstandingAmount > 0) ? (
 <ResponsiveContainer width="100%" height="100%">
 <RechartsPieChart>
 <Pie
 data={agingRows.filter((a) => a.outstandingAmount > 0)}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={100}
 paddingAngle={2}
 dataKey="outstandingAmount"
 nameKey="classification"
 >
 {agingRows
 .filter((a) => a.outstandingAmount > 0)
 .map((entry) => (
 <Cell key={entry.classification} fill={agingColor(entry.classification)} />
 ))}
 </Pie>
 <Tooltip
 formatter={(value: number) => formatCurrency(value)}
 contentStyle={{
 backgroundColor: "hsl(var(--card))",
 border: "1px solid hsl(var(--border))",
 }}
 />
 <Legend formatter={(value) => agingRows.find((r) => r.classification === value)?.label ?? value} />
 </RechartsPieChart>
 </ResponsiveContainer>
 ) : (
 <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
 No aging breakdown for this scope.
 </p>
 )}
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Provision Requirements</CardTitle>
 <CardDescription>Based on classification and BOT rates</CardDescription>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Classification</TableHead>
 <TableHead className="text-right">Outstanding</TableHead>
 <TableHead className="text-center">Rate</TableHead>
 <TableHead className="text-right">Provision</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {agingRows.map((item) => (
 <TableRow key={item.classification}>
 <TableCell>
 <div className="flex items-center gap-2">
 <div
 className="h-3 w-3 rounded-full"
 style={{ backgroundColor: agingColor(item.classification) }}
 />
 {item.label}
 </div>
 </TableCell>
 <TableCell className="text-right">{formatCurrency(item.outstandingAmount)}</TableCell>
 <TableCell className="text-center">{safeRate(item.provisionRate).toFixed(0)}%</TableCell>
 <TableCell className="text-right font-medium">
 {formatCurrency(item.provisionAmount)}
 </TableCell>
 </TableRow>
 ))}
 <TableRow className="font-bold">
 <TableCell>Total</TableCell>
 <TableCell className="text-right">
 {formatCurrency(aging?.totalOutstanding ?? 0)}
 </TableCell>
 <TableCell />
 <TableCell className="text-right text-warning">
 {formatCurrency(aging?.totalProvision ?? 0)}
 </TableCell>
 </TableRow>
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </div>
 </TabsContent>

 <TabsContent value="products">
 <Card>
 <CardHeader>
 <CardTitle>Product Performance</CardTitle>
 <CardDescription>Portfolio breakdown by loan product</CardDescription>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Product</TableHead>
 <TableHead className="text-center">Active Loans</TableHead>
 <TableHead className="text-right">Outstanding</TableHead>
 <TableHead className="text-right">PAR ({">"}30d)</TableHead>
 <TableHead className="text-right">PAR Rate</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {productPerformance.length ? (
 productPerformance.map((product) => (
 <TableRow key={product.productId || product.code || product.name}>
 <TableCell>
 <div>
 <p className="font-medium">{product.name}</p>
 {product.code ? (
 <p className="text-sm text-muted-foreground">{product.code}</p>
 ) : null}
 </div>
 </TableCell>
 <TableCell className="text-center">{product.loanCount}</TableCell>
 <TableCell className="text-right">{formatCurrency(product.outstanding)}</TableCell>
 <TableCell className="text-right text-destructive">{formatCurrency(product.par)}</TableCell>
 <TableCell className="text-right">
 <span
 className={
 product.parRate > 10
 ? "text-destructive"
 : product.parRate > 5
 ? "text-warning"
 : "text-accent"
 }
 >
 {safeRate(product.parRate).toFixed(1)}%
 </span>
 </TableCell>
 </TableRow>
 ))
 ) : (
 <TableRow>
 <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
 No product rows for this scope.
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="branches">
 <Card>
 <CardHeader>
 <CardTitle>{scopedBranchId ? "Your branch" : "Branch Performance"}</CardTitle>
 <CardDescription>
 {scopedBranchId
 ? `Live portfolio metrics for ${scopeLabel}`
 : "Portfolio breakdown by branch"}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Branch</TableHead>
 <TableHead className="text-center">Active Loans</TableHead>
 <TableHead className="text-right">Disbursed</TableHead>
 <TableHead className="text-right">Collected</TableHead>
 <TableHead className="text-right">Outstanding</TableHead>
 <TableHead className="text-right">Collection Rate</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {branchPerformanceDisplay.length ? (
 branchPerformanceDisplay.map((branch) => (
 <TableRow key={branch.branchId || branch.code || branch.name}>
 <TableCell>
 <div>
 <p className="font-medium">{branch.name}</p>
 {branch.code ? (
 <p className="text-sm text-muted-foreground">{branch.code}</p>
 ) : null}
 </div>
 </TableCell>
 <TableCell className="text-center">{branch.loanCount}</TableCell>
 <TableCell className="text-right">{formatCurrency(branch.disbursed)}</TableCell>
 <TableCell className="text-right text-accent">{formatCurrency(branch.collected)}</TableCell>
 <TableCell className="text-right">{formatCurrency(branch.outstanding)}</TableCell>
 <TableCell className="text-right">
 <span
 className={
 branch.collectionRate > 80
 ? "text-accent"
 : branch.collectionRate > 60
 ? "text-warning"
 : "text-destructive"
 }
 >
 {safeRate(branch.collectionRate).toFixed(1)}%
 </span>
 </TableCell>
 </TableRow>
 ))
 ) : (
 <TableRow>
 <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
 No branch performance data for this scope.
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </>
 ) : !loading && !error ? (
 <Card>
 <CardContent className="py-10 text-center text-sm text-muted-foreground">
 No report data is available for the selected filters.
 </CardContent>
 </Card>
 ) : null}
 </div>
 </main>
 </>
 );
}
