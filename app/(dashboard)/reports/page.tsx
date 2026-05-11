"use client";

import { useState } from "react";
import {
 Download,
 FileText,
 Calendar,
 TrendingUp,
 AlertTriangle,
 PieChart,
 BarChart3,
 ArrowUpRight,
 ArrowDownRight,
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
 loans,
 loanProducts,
 branches,
 customers,
 loanApplications,
 collectionActivities,
 formatDateTime,
 getCustomerById,
 getProductById,
 formatCurrency,
} from "@/lib/mock-data";
import type { RiskClassification } from "@/lib/types";
import { useSessionUser } from "@/lib/use-session-user";
import { exportBranchReportPdf } from "@/lib/branch-report-pdf";

// Mock data for reports
const monthlyData = [
 { month: "Aug", disbursements: 45000000, collections: 38000000, newLoans: 28, closedLoans: 15 },
 { month: "Sep", disbursements: 52000000, collections: 44000000, newLoans: 35, closedLoans: 22 },
 { month: "Oct", disbursements: 48000000, collections: 46000000, newLoans: 32, closedLoans: 28 },
 { month: "Nov", disbursements: 55000000, collections: 51000000, newLoans: 40, closedLoans: 32 },
 { month: "Dec", disbursements: 42000000, collections: 48000000, newLoans: 25, closedLoans: 30 },
 { month: "Jan", disbursements: 15866000, collections: 12500000, newLoans: 6, closedLoans: 4 },
];

const riskConfig: Record<RiskClassification, { label: string; color: string }> = {
 current: { label: "Current", color: "#22c55e" },
 especially_mentioned: { label: "Watch (1-30d)", color: "#eab308" },
 substandard: { label: "Substandard (31-90d)", color: "#f97316" },
 doubtful: { label: "Doubtful (91-180d)", color: "#ef4444" },
 loss: { label: "Loss (>180d)", color: "#1f2937" },
};

const provisionRates: Record<RiskClassification, number> = {
 current: 0,
 especially_mentioned: 5,
 substandard: 20,
 doubtful: 50,
 loss: 100,
};

function formatYAxis(value: number) {
 if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
 if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
 return value.toString();
}

function getPeriodStartDate(period: string): Date {
 const now = new Date();
 const start = new Date(now);
 if (period === "1m") start.setMonth(now.getMonth() - 1);
 if (period === "3m") start.setMonth(now.getMonth() - 3);
 if (period === "6m") start.setMonth(now.getMonth() - 6);
 if (period === "1y") start.setFullYear(now.getFullYear() - 1);
 return start;
}

function inRange(value: string | undefined, startDate: Date): boolean {
 if (!value) return false;
 const parsed = new Date(value);
 return !Number.isNaN(parsed.getTime()) && parsed >= startDate;
}

function inDateRange(value: string | undefined, startDate?: Date, endDate?: Date): boolean {
 if (!value) return false;
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return false;
 if (startDate && parsed < startDate) return false;
 if (endDate && parsed > endDate) return false;
 return true;
}

function toInputDate(value: Date): string {
 return value.toISOString().slice(0, 10);
}

export default function ReportsPage() {
 const { user } = useSessionUser();
 const isManagerView = user?.role === "branch_manager";
 const isOfficerView = user?.role === "loan_officer";
 const scopeBranchId = user?.role === "branch_manager" || user?.role === "loan_officer" ? user.branch_id : null;
 const [period, setPeriod] = useState("6m");
 const [startDateFilter, setStartDateFilter] = useState<string>("");
 const [endDateFilter, setEndDateFilter] = useState<string>("");
 const [exportOption, setExportOption] = useState<"pdf" | "csv" | "json">("pdf");
 const periodLabelMap: Record<string, string> = {
 "1m": "Last Month",
 "3m": "Last 3 Months",
 "6m": "Last 6 Months",
 "1y": "Last Year",
 };
 const presetStartDate = getPeriodStartDate(period);
 const startDate = startDateFilter ? new Date(`${startDateFilter}T00:00:00`) : presetStartDate;
 const endDate = endDateFilter ? new Date(`${endDateFilter}T23:59:59.999`) : undefined;
 const dateRangeLabel = `${toInputDate(startDate)}${endDate ? ` to ${toInputDate(endDate)}` : " to now"}`;

 const visibleLoans = scopeBranchId
 ? loans.filter((loan) => {
 if (loan.branch_id !== scopeBranchId) return false;
 if (!isOfficerView || !user) return true;
 return loan.loan_officer_id === user.id;
 })
 : loans;
 const visibleBranches = scopeBranchId
 ? branches.filter((branch) => branch.id === scopeBranchId)
 : branches;
 const totalPortfolio = visibleLoans.reduce((sum, l) => sum + l.total_outstanding, 0);
 const totalPAR = visibleLoans
 .filter((l) => l.days_in_arrears > 30)
 .reduce((sum, l) => sum + l.total_outstanding, 0);
 const parRatio = totalPortfolio > 0 ? (totalPAR / totalPortfolio) * 100 : 0;
 const nplRatio = totalPortfolio > 0
 ? (
 visibleLoans
 .filter((loan) => loan.status === "defaulted" || loan.status === "written_off")
 .reduce((sum, loan) => sum + loan.total_outstanding, 0) / totalPortfolio
 ) * 100
 : 0;

 const productPerformance = loanProducts.map((product) => {
 const productLoans = visibleLoans.filter((l) => l.product_id === product.id);
 const outstanding = productLoans.reduce((sum, l) => sum + l.total_outstanding, 0);
 const par = productLoans
 .filter((l) => l.days_in_arrears > 30)
 .reduce((sum, l) => sum + l.total_outstanding, 0);
 return {
 name: product.name,
 code: product.code,
 loanCount: productLoans.length,
 outstanding,
 par,
 parRate: outstanding > 0 ? (par / outstanding) * 100 : 0,
 };
 });

 const branchPerformance = visibleBranches.map((branch) => {
 const branchLoans = visibleLoans.filter((l) => l.branch_id === branch.id);
 const outstanding = branchLoans.reduce((sum, l) => sum + l.total_outstanding, 0);
 const collected = branchLoans.reduce((sum, l) => sum + l.total_paid, 0);
 const disbursed = branchLoans.reduce((sum, l) => sum + l.principal_amount, 0);
 return {
 name: branch.name,
 code: branch.code,
 loanCount: branchLoans.length,
 outstanding,
 collected,
 disbursed,
 collectionRate: disbursed > 0 ? (collected / disbursed) * 100 : 0,
 };
 });

 const scopedAgingReport = (Object.keys(riskConfig) as RiskClassification[]).map((classification) => {
 const bucketLoans = visibleLoans.filter((loan) => loan.risk_classification === classification);
 const outstanding_amount = bucketLoans.reduce((sum, loan) => sum + loan.total_outstanding, 0);
 const provision_amount = outstanding_amount * (provisionRates[classification] / 100);
 return {
 classification,
 loan_count: bucketLoans.length,
 outstanding_amount,
 provision_amount,
 percentage: totalPortfolio > 0 ? (outstanding_amount / totalPortfolio) * 100 : 0,
 };
 });

 const totalProvision = scopedAgingReport.reduce((sum, a) => sum + a.provision_amount, 0);
 const visibleApplications = (scopeBranchId
 ? loanApplications.filter((item) => {
 if (item.branch_id !== scopeBranchId) return false;
 if (!isOfficerView || !user) return true;
 return item.created_by === user.id;
 })
 : loanApplications
 ).filter((item) => inDateRange(item.created_at, startDate, endDate));
 const visibleCustomers = (scopeBranchId
 ? customers.filter((item) => {
 if (item.branch_id !== scopeBranchId) return false;
 if (!isOfficerView || !user) return true;
 return item.assigned_loan_officer_id === user.id || item.created_by === user.id;
 })
 : customers
 ).filter((item) => inDateRange(item.created_at, startDate, endDate));
 const visibleCollections = (scopeBranchId
 ? collectionActivities.filter((activity) =>
 visibleLoans.some((loan) => loan.id === activity.loan_id)
 )
 : collectionActivities
 ).filter((item) => inDateRange(item.performed_at, startDate, endDate));
 const periodLoans = visibleLoans.filter((loan) => inDateRange(loan.disbursement_date, startDate, endDate));
 const reportBranchName = scopeBranchId
 ? branches.find((branch) => branch.id === scopeBranchId)?.name ?? scopeBranchId
 : "All Branches";

 const reportPayload = {
 branchName: reportBranchName,
 periodLabel: endDate || startDateFilter ? `Custom (${dateRangeLabel})` : periodLabelMap[period] ?? "Selected Period",
 generatedAt: formatDateTime(new Date().toISOString()),
 summary: {
 totalPortfolio,
 totalPar: totalPAR,
 parRatio,
 nplRatio,
 requiredProvision: totalProvision,
 },
 productPerformance: productPerformance.map((product) => ({
 name: product.name,
 loanCount: product.loanCount,
 outstanding: product.outstanding,
 par: product.par,
 parRate: product.parRate,
 })),
 agingReport: scopedAgingReport.map((item) => ({
 classificationLabel: riskConfig[item.classification].label,
 outstanding: item.outstanding_amount,
 provision: item.provision_amount,
 rate: provisionRates[item.classification],
 })),
 branchPerformance: branchPerformance.map((branch) => ({
 name: branch.name,
 loanCount: branch.loanCount,
 disbursed: branch.disbursed,
 collected: branch.collected,
 outstanding: branch.outstanding,
 collectionRate: branch.collectionRate,
 })),
 applications: visibleApplications.map((app) => {
 const customer = getCustomerById(app.customer_id);
 return {
 application_number: app.application_number,
 customer_name: customer ? `${customer.first_name} ${customer.last_name}` : app.customer_id,
 status: app.status,
 amount: app.requested_amount,
 created_at: formatDateTime(app.created_at),
 };
 }),
 customers: visibleCustomers.map((customer) => ({
 customer_number: customer.customer_number,
 customer_name: `${customer.first_name} ${customer.last_name}`,
 phone: customer.phone_primary,
 region: customer.region,
 district: customer.district,
 })),
 loans: periodLoans.map((loan) => {
 const customer = getCustomerById(loan.customer_id);
 const product = getProductById(loan.product_id);
 return {
 loan_number: loan.loan_number,
 customer_name: customer ? `${customer.first_name} ${customer.last_name}` : loan.customer_id,
 product_name: product?.name ?? loan.product_id,
 principal: loan.principal_amount,
 outstanding: loan.total_outstanding,
 status: loan.status,
 };
 }),
 collections: visibleCollections.map((item) => {
 const customer = getCustomerById(item.customer_id);
 return {
 action: item.action,
 customer_name: customer ? `${customer.first_name} ${customer.last_name}` : item.customer_id,
 notes: item.notes,
 performed_at: formatDateTime(item.performed_at),
 };
 }),
 };

 const downloadTextFile = (filename: string, content: string, mimeType: string) => {
 const blob = new Blob([content], { type: mimeType });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = filename;
 document.body.appendChild(anchor);
 anchor.click();
 anchor.remove();
 URL.revokeObjectURL(url);
 };

 const exportDetailedReport = () => {
 if (exportOption === "json") {
 downloadTextFile(
 `reports-${new Date().toISOString().slice(0, 10)}.json`,
 JSON.stringify(reportPayload, null, 2),
 "application/json"
 );
 return;
 }
 if (exportOption === "csv") {
 const rows = [
 ["section", "key", "value"],
 ["summary", "branch", reportPayload.branchName],
 ["summary", "period", reportPayload.periodLabel],
 ["summary", "totalPortfolio", String(reportPayload.summary.totalPortfolio)],
 ["summary", "totalPar", String(reportPayload.summary.totalPar)],
 ["summary", "parRatio", reportPayload.summary.parRatio.toFixed(2)],
 ["summary", "nplRatio", reportPayload.summary.nplRatio.toFixed(2)],
 ["summary", "requiredProvision", String(reportPayload.summary.requiredProvision)],
 ];
 const csv = rows
 .map((row) =>
 row
 .map((cell) => `"${String(cell).replaceAll(`"`, `""`)}"`)
 .join(",")
 )
 .join("\n");
 downloadTextFile(
 `reports-${new Date().toISOString().slice(0, 10)}.csv`,
 csv,
 "text/csv"
 );
 return;
 }
 exportBranchReportPdf({
 ...reportPayload,
 });
 };
 const officerPendingApplications = visibleApplications.filter(
 (item) => item.status === "submitted" || item.status === "under_review"
 ).length;
 const officerAtRiskLoans = visibleLoans.filter((loan) => loan.days_in_arrears > 0).length;
 const officerCollectionOutcome = visibleLoans.reduce((sum, loan) => sum + loan.total_paid, 0);

 return (
 <>
 <DashboardHeader
 title="Reports"
 description="Portfolio analysis and regulatory reports"
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 {/* Header Actions */}
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
 <Button variant="outline" onClick={exportDetailedReport}>
 <Download className="mr-2 h-4 w-4" />
 Export Report
 </Button>
 </div>
 </div>

 {/* Summary Cards */}
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Total Portfolio
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{formatCurrency(totalPortfolio)}</div>
 <div className="flex items-center gap-1 text-sm">
 <ArrowUpRight className="h-4 w-4 text-accent" />
 <span className="text-accent">+12.5%</span>
 <span className="text-muted-foreground">vs last month</span>
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Portfolio at Risk ({">"}30d)
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-destructive">{formatCurrency(totalPAR)}</div>
 <div className="flex items-center gap-1 text-sm">
 <ArrowDownRight className="h-4 w-4 text-destructive" />
 <span className="text-destructive">{parRatio.toFixed(1)}%</span>
 <span className="text-muted-foreground">PAR ratio</span>
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 NPL Ratio
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{nplRatio.toFixed(1)}%</div>
 <p className="text-sm text-muted-foreground">Non-performing loans</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Required Provision
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-warning">{formatCurrency(totalProvision)}</div>
 <p className="text-sm text-muted-foreground">Per BOT guidelines</p>
 </CardContent>
 </Card>
 </div>

 {/* Tabs */}
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
 {isManagerView || isOfficerView ? (
 <TabsTrigger value="operations" className="gap-2">
 <FileText className="h-4 w-4" />
 {isOfficerView ? "My Operations" : "Operations Data"}
 </TabsTrigger>
 ) : null}
 </TabsList>

 {/* Portfolio Tab */}
 <TabsContent value="portfolio" className="space-y-6">
 <div className="grid gap-6 lg:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle>Disbursements vs Collections</CardTitle>
 <CardDescription>Monthly comparison</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-[300px]">
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
 <Bar dataKey="disbursements" name="Disbursements" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
 <Bar dataKey="collections" name="Collections" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
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
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={monthlyData}>
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
 dataKey="disbursements"
 name="Portfolio"
 stroke="hsl(var(--primary))"
 fill="url(#portfolioGrad)"
 strokeWidth={2}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle>Loan Activity Summary</CardTitle>
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
 {monthlyData.map((month) => (
 <TableRow key={month.month}>
 <TableCell className="font-medium">{month.month}</TableCell>
 <TableCell className="text-right">{formatCurrency(month.disbursements)}</TableCell>
 <TableCell className="text-right">{formatCurrency(month.collections)}</TableCell>
 <TableCell className="text-right">{month.newLoans}</TableCell>
 <TableCell className="text-right">{month.closedLoans}</TableCell>
 <TableCell className="text-right">
 <span className={month.newLoans - month.closedLoans >= 0 ? "text-accent" : "text-destructive"}>
 {month.newLoans - month.closedLoans >= 0 ? "+" : ""}
 {month.newLoans - month.closedLoans}
 </span>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Aging Analysis Tab */}
 <TabsContent value="aging" className="space-y-6">
 <div className="grid gap-6 lg:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle>Portfolio Aging (BOT Classification)</CardTitle>
 <CardDescription>Based on Bank of Tanzania guidelines</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-[300px]">
 <ResponsiveContainer width="100%" height="100%">
 <RechartsPieChart>
 <Pie
 data={scopedAgingReport.filter((a) => a.outstanding_amount > 0)}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={100}
 paddingAngle={2}
 dataKey="outstanding_amount"
 nameKey="classification"
 >
 {scopedAgingReport.map((entry) => (
 <Cell
 key={entry.classification}
 fill={riskConfig[entry.classification].color}
 />
 ))}
 </Pie>
 <Tooltip
 formatter={(value: number) => formatCurrency(value)}
 contentStyle={{
 backgroundColor: "hsl(var(--card))",
 border: "1px solid hsl(var(--border))",
 }}
 />
 <Legend
 formatter={(value) => riskConfig[value as RiskClassification]?.label || value}
 />
 </RechartsPieChart>
 </ResponsiveContainer>
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
 {scopedAgingReport.map((item) => (
 <TableRow key={item.classification}>
 <TableCell>
 <div className="flex items-center gap-2">
 <div
 className="h-3 w-3 rounded-full"
 style={{ backgroundColor: riskConfig[item.classification].color }}
 />
 {riskConfig[item.classification].label}
 </div>
 </TableCell>
 <TableCell className="text-right">{formatCurrency(item.outstanding_amount)}</TableCell>
 <TableCell className="text-center">{provisionRates[item.classification]}%</TableCell>
 <TableCell className="text-right font-medium">{formatCurrency(item.provision_amount)}</TableCell>
 </TableRow>
 ))}
 <TableRow className="font-bold">
 <TableCell>Total</TableCell>
 <TableCell className="text-right">
 {formatCurrency(scopedAgingReport.reduce((s, a) => s + a.outstanding_amount, 0))}
 </TableCell>
 <TableCell />
 <TableCell className="text-right text-warning">
 {formatCurrency(scopedAgingReport.reduce((s, a) => s + a.provision_amount, 0))}
 </TableCell>
 </TableRow>
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </div>
 </TabsContent>

 {/* Products Tab */}
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
 {productPerformance.map((product) => (
 <TableRow key={product.code}>
 <TableCell>
 <div>
 <p className="font-medium">{product.name}</p>
 <p className="text-sm text-muted-foreground">{product.code}</p>
 </div>
 </TableCell>
 <TableCell className="text-center">{product.loanCount}</TableCell>
 <TableCell className="text-right">{formatCurrency(product.outstanding)}</TableCell>
 <TableCell className="text-right text-destructive">{formatCurrency(product.par)}</TableCell>
 <TableCell className="text-right">
 <span className={product.parRate > 10 ? "text-destructive" : product.parRate > 5 ? "text-warning" : "text-accent"}>
 {product.parRate.toFixed(1)}%
 </span>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Branches Tab */}
 <TabsContent value="branches">
 <Card>
 <CardHeader>
 <CardTitle>Branch Performance</CardTitle>
 <CardDescription>Portfolio breakdown by branch</CardDescription>
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
 {branchPerformance.map((branch) => (
 <TableRow key={branch.code}>
 <TableCell>
 <div>
 <p className="font-medium">{branch.name}</p>
 <p className="text-sm text-muted-foreground">{branch.code}</p>
 </div>
 </TableCell>
 <TableCell className="text-center">{branch.loanCount}</TableCell>
 <TableCell className="text-right">{formatCurrency(branch.disbursed)}</TableCell>
 <TableCell className="text-right text-accent">{formatCurrency(branch.collected)}</TableCell>
 <TableCell className="text-right">{formatCurrency(branch.outstanding)}</TableCell>
 <TableCell className="text-right">
 <span className={branch.collectionRate > 80 ? "text-accent" : branch.collectionRate > 60 ? "text-warning" : "text-destructive"}>
 {branch.collectionRate.toFixed(1)}%
 </span>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </TabsContent>

 {isManagerView || isOfficerView ? (
 <TabsContent value="operations" className="space-y-6">
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Applications</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{visibleApplications.length}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{visibleCustomers.length}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Loans</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{periodLoans.length}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Collections</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{visibleCollections.length}</p>
 </CardContent>
 </Card>
 </div>

 {isOfficerView ? (
 <div className="grid gap-4 md:grid-cols-3">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reviews</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{officerPendingApplications}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">At-risk Loans</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{officerAtRiskLoans}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Collection Outcome</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{formatCurrency(officerCollectionOutcome)}</p>
 </CardContent>
 </Card>
 </div>
 ) : null}

 <Card>
 <CardHeader>
 <CardTitle>Loan Applications List</CardTitle>
 <CardDescription>Application status and amounts for selected period</CardDescription>
 </CardHeader>
 <CardContent className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Application #</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead>Created</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {visibleApplications.map((app) => {
 const customer = getCustomerById(app.customer_id);
 return (
 <TableRow key={app.id}>
 <TableCell className="font-mono">{app.application_number}</TableCell>
 <TableCell>{customer ? `${customer.first_name} ${customer.last_name}` : app.customer_id}</TableCell>
 <TableCell className="capitalize">{app.status.replace(/_/g, " ")}</TableCell>
 <TableCell className="text-right">{formatCurrency(app.requested_amount)}</TableCell>
 <TableCell>{formatDateTime(app.created_at)}</TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Customers Details</CardTitle>
 <CardDescription>Customer roster and location contacts</CardDescription>
 </CardHeader>
 <CardContent className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Customer #</TableHead>
 <TableHead>Name</TableHead>
 <TableHead>Phone</TableHead>
 <TableHead>Region</TableHead>
 <TableHead>District</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {visibleCustomers.map((customer) => (
 <TableRow key={customer.id}>
 <TableCell className="font-mono">{customer.customer_number}</TableCell>
 <TableCell>{customer.first_name} {customer.last_name}</TableCell>
 <TableCell>{customer.phone_primary}</TableCell>
 <TableCell>{customer.region}</TableCell>
 <TableCell>{customer.district}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>

 <div className="grid gap-6 lg:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle>Loans</CardTitle>
 <CardDescription>Disbursed loans in selected period</CardDescription>
 </CardHeader>
 <CardContent className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Loan #</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead className="text-right">Principal</TableHead>
 <TableHead className="text-right">Outstanding</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {periodLoans.map((loan) => {
 const customer = getCustomerById(loan.customer_id);
 return (
 <TableRow key={loan.id}>
 <TableCell className="font-mono">{loan.loan_number}</TableCell>
 <TableCell>{customer ? `${customer.first_name} ${customer.last_name}` : loan.customer_id}</TableCell>
 <TableCell className="text-right">{formatCurrency(loan.principal_amount)}</TableCell>
 <TableCell className="text-right">{formatCurrency(loan.total_outstanding)}</TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Collections</CardTitle>
 <CardDescription>Collection actions logged in selected period</CardDescription>
 </CardHeader>
 <CardContent className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Action</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead>Performed</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {visibleCollections.map((item) => {
 const customer = getCustomerById(item.customer_id);
 return (
 <TableRow key={item.id}>
 <TableCell className="capitalize">{item.action.replace(/_/g, " ")}</TableCell>
 <TableCell>{customer ? `${customer.first_name} ${customer.last_name}` : item.customer_id}</TableCell>
 <TableCell>{formatDateTime(item.performed_at)}</TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </div>
 </TabsContent>
 ) : null}
 </Tabs>
 </div>
 </main>
 </>
 );
}
