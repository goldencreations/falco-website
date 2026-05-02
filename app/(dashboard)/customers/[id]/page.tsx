"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Briefcase,
  Calendar,
  Shield,
  CreditCard,
  AlertTriangle,
  Edit,
  Ban,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  FileText,
  Activity,
  Download,
  PieChart,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  customers,
  getLoansByCustomerId,
  getProductById,
  loanApplications,
  payments,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/mock-data";
import type { RiskGrade, LoanStatus } from "@/lib/types";

const riskGradeConfig: Record<RiskGrade, { label: string; color: string; bgColor: string }> = {
  A: { label: "Grade A - Low Risk", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  B: { label: "Grade B - Moderate Risk", color: "text-cyan-700", bgColor: "bg-cyan-100" },
  C: { label: "Grade C - Average Risk", color: "text-amber-700", bgColor: "bg-amber-100" },
  D: { label: "Grade D - High Risk", color: "text-orange-700", bgColor: "bg-orange-100" },
  E: { label: "Grade E - Very High Risk", color: "text-red-700", bgColor: "bg-red-100" },
};

const loanStatusConfig: Record<LoanStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  pending_disbursement: { label: "Pending", variant: "secondary", color: "bg-slate-500" },
  active: { label: "Active", variant: "default", color: "bg-emerald-500" },
  in_arrears: { label: "In Arrears", variant: "destructive", color: "bg-amber-500" },
  defaulted: { label: "Defaulted", variant: "destructive", color: "bg-red-500" },
  written_off: { label: "Written Off", variant: "outline", color: "bg-slate-800" },
  paid_off: { label: "Paid Off", variant: "default", color: "bg-cyan-500" },
  restructured: { label: "Restructured", variant: "secondary", color: "bg-purple-500" },
};

// Generate mock payment history trend data
function generatePaymentTrend(customerId: string) {
  const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  return months.map((month, i) => ({
    month,
    expected: 400000 + Math.random() * 200000,
    actual: 350000 + Math.random() * 250000,
    onTime: Math.floor(70 + Math.random() * 30),
  }));
}

// Generate credit score history
function generateCreditScoreHistory(currentScore: number) {
  const months = ["Aug 23", "Sep 23", "Oct 23", "Nov 23", "Dec 23", "Jan 24", "Feb 24", "Mar 24"];
  let score = currentScore - 80;
  return months.map((month) => {
    score += Math.floor(Math.random() * 20 - 5);
    score = Math.max(300, Math.min(850, score));
    return { month, score };
  });
}

// Generate loan distribution data
function generateLoanDistribution(loans: { product_id: string; principal_amount: number }[]) {
  const distribution: Record<string, number> = {};
  loans.forEach((loan) => {
    const product = getProductById(loan.product_id);
    const name = product?.name || "Unknown";
    distribution[name] = (distribution[name] || 0) + loan.principal_amount;
  });
  return Object.entries(distribution).map(([name, value]) => ({ name, value }));
}

const CHART_COLORS = ["#0d9488", "#0891b2", "#6366f1", "#f59e0b", "#ef4444"];

type CustomerExportPayload = {
  generated_at: string;
  customer: {
    customer_number: string;
    full_name: string;
    customer_type: string;
    national_id: string;
    phone_primary: string;
    phone_secondary: string | null;
    email: string | null;
    physical_address: string;
    ward: string;
    district: string;
    region: string;
    risk_grade: string;
    credit_score: number | null;
    is_blacklisted: boolean;
    monthly_income: number;
    branch_name: string;
    created_by_name: string;
    created_at: string;
  };
  summary: {
    total_loans: number;
    total_borrowed: number;
    total_paid: number;
    total_outstanding: number;
    total_payments: number;
  };
  loans: Array<{
    loan_number: string;
    status: string;
    product_name: string;
    principal_amount: number;
    total_paid: number;
    total_outstanding: number;
    disbursement_date: string;
    maturity_date: string;
    follow_up_loan_officer: string;
    branch_manager: string;
  }>;
  payments: Array<{
    payment_number: string;
    amount: number;
    payment_method: string;
    payment_status: string;
    payment_date: string;
    received_by: string;
    loan_number: string;
    follow_up_loan_officer: string;
  }>;
};

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [isExporting, setIsExporting] = useState(false);
  const customer = customers.find((c) => c.id === resolvedParams.id);

  const customerLoans = useMemo(
    () => (customer ? getLoansByCustomerId(customer.id) : []),
    [customer]
  );
  const customerApplications = useMemo(
    () => (customer ? loanApplications.filter((app) => app.customer_id === customer.id) : []),
    [customer]
  );
  const customerPayments = useMemo(
    () => (customer ? payments.filter((p) => p.customer_id === customer.id) : []),
    [customer]
  );

  const paymentTrend = useMemo(
    () => (customer ? generatePaymentTrend(customer.id) : []),
    [customer]
  );
  const creditHistory = useMemo(
    () => (customer?.credit_score ? generateCreditScoreHistory(customer.credit_score) : []),
    [customer?.credit_score]
  );
  const loanDistribution = useMemo(
    () => generateLoanDistribution(customerLoans),
    [customerLoans]
  );

  if (!customer) {
    return (
      <>
        <DashboardHeader title="Customer Not Found" />
        <main className="flex-1 p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Customer not found</p>
            <Button asChild className="mt-4">
              <Link href="/customers">Back to Customers</Link>
            </Button>
          </div>
        </main>
      </>
    );
  }

  const risk = riskGradeConfig[customer.risk_grade];
  const totalBorrowed = customerLoans.reduce((sum, l) => sum + l.principal_amount, 0);
  const totalOutstanding = customerLoans.reduce((sum, l) => sum + l.total_outstanding, 0);
  const totalPaid = customerLoans.reduce((sum, l) => sum + l.total_paid, 0);
  const activeLoans = customerLoans.filter((l) => l.status === "active" || l.status === "in_arrears");
  const completedLoans = customerLoans.filter((l) => l.status === "paid_off");
  const onTimePayments = customerPayments.filter((p) => p.status === "completed").length;
  const repaymentRate = customerPayments.length > 0 ? (onTimePayments / customerPayments.length) * 100 : 0;

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      const response = await fetch(`/api/customers/${resolvedParams.id}/export`);
      if (!response.ok) {
        throw new Error(`Export endpoint returned ${response.status}`);
      }
      const data = (await response.json()) as CustomerExportPayload;

      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableModule.default;

      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(16);
      doc.text("Customer Portfolio Report", 14, 16);
      doc.setFontSize(10);
      doc.text(`Generated: ${formatDateTime(data.generated_at)}`, 14, 22);
      doc.text(`Customer: ${data.customer.full_name} (${data.customer.customer_number})`, 14, 28);

      autoTable(doc, {
        startY: 34,
        theme: "grid",
        styles: { fontSize: 9 },
        head: [["Customer Profile", "Value"]],
        body: [
          ["Customer Type", data.customer.customer_type],
          ["National ID", data.customer.national_id],
          ["Primary Phone", data.customer.phone_primary],
          ["Email", data.customer.email ?? "N/A"],
          ["Branch", data.customer.branch_name],
          ["Risk Grade", data.customer.risk_grade],
          ["Credit Score", data.customer.credit_score?.toString() ?? "N/A"],
          ["Monthly Income", formatCurrency(data.customer.monthly_income)],
          ["Address", `${data.customer.physical_address}, ${data.customer.district}, ${data.customer.region}`],
          ["Created By", data.customer.created_by_name],
        ],
      });

      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
          ? ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6)
          : 92,
        theme: "striped",
        styles: { fontSize: 9 },
        head: [["Summary", "Value"]],
        body: [
          ["Total Loans", data.summary.total_loans.toString()],
          ["Total Borrowed", formatCurrency(data.summary.total_borrowed)],
          ["Total Paid", formatCurrency(data.summary.total_paid)],
          ["Total Outstanding", formatCurrency(data.summary.total_outstanding)],
          ["Payments Recorded", data.summary.total_payments.toString()],
        ],
      });

      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
          ? ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8)
          : 130,
        theme: "grid",
        styles: { fontSize: 8 },
        head: [[
          "Loan",
          "Product",
          "Status",
          "Principal",
          "Outstanding",
          "Follow-up Officer",
          "Branch Manager",
        ]],
        body: data.loans.map((loan) => [
          loan.loan_number,
          loan.product_name,
          loan.status,
          formatCurrency(loan.principal_amount),
          formatCurrency(loan.total_outstanding),
          loan.follow_up_loan_officer,
          loan.branch_manager,
        ]),
      });

      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
          ? ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8)
          : 180,
        theme: "grid",
        styles: { fontSize: 8 },
        head: [[
          "Payment #",
          "Date",
          "Amount",
          "Method",
          "Status",
          "Received By",
          "Loan",
          "Follow-up Officer",
        ]],
        body: data.payments.map((payment) => [
          payment.payment_number,
          formatDateTime(payment.payment_date),
          formatCurrency(payment.amount),
          payment.payment_method.replace("_", " "),
          payment.payment_status,
          payment.received_by,
          payment.loan_number,
          payment.follow_up_loan_officer,
        ]),
        didDrawPage: () => {
          doc.setFontSize(8);
          doc.text(
            "Falco Financial Services - customer report export (backend route ready: /api/customers/:id/export)",
            14,
            doc.internal.pageSize.getHeight() - 6
          );
          doc.text(
            `Page ${doc.getNumberOfPages()}`,
            pageWidth - 28,
            doc.internal.pageSize.getHeight() - 6
          );
        },
      });

      doc.save(`${data.customer.customer_number}-customer-report.pdf`);
    } catch (exportError) {
      console.error("Failed to export customer PDF", exportError);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <DashboardHeader
        title="Customer Profile"
        description={customer.customer_number}
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/customers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Customers
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export Report"}
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              {!customer.is_blacklisted && (
                <Button variant="destructive" size="sm">
                  <Ban className="mr-2 h-4 w-4" />
                  Blacklist
                </Button>
              )}
            </div>
          </div>

          {/* Customer Header Card */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                    {customer.first_name[0]}
                    {customer.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold text-foreground">
                        {customer.first_name} {customer.middle_name} {customer.last_name}
                      </h2>
                      {customer.is_blacklisted && (
                        <Badge variant="destructive" className="bg-red-600">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Blacklisted
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground font-mono">{customer.customer_number}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize border-primary/30">
                      {customer.customer_type === "business" ? (
                        <Building2 className="mr-1 h-3 w-3 text-primary" />
                      ) : (
                        <User className="mr-1 h-3 w-3 text-primary" />
                      )}
                      {customer.customer_type}
                    </Badge>
                    <Badge className={`${risk.bgColor} ${risk.color} border-0`}>
                      <Shield className="mr-1 h-3 w-3" />
                      {risk.label}
                    </Badge>
                    {customer.credit_score && (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        <Activity className="mr-1 h-3 w-3" />
                        Credit Score: {customer.credit_score}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="bg-gradient-to-br from-cyan-50 to-white border-cyan-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-cyan-700 font-medium">Total Borrowed</p>
                    <p className="text-2xl font-bold text-cyan-900">{formatCurrency(totalBorrowed)}</p>
                    <p className="text-xs text-cyan-600">{customerLoans.length} loans</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-cyan-100 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-cyan-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-700 font-medium">Total Repaid</p>
                    <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totalPaid)}</p>
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {totalBorrowed > 0 ? ((totalPaid / (totalBorrowed + (totalBorrowed * 0.15))) * 100).toFixed(0) : 0}% of total
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-700 font-medium">Outstanding</p>
                    <p className="text-2xl font-bold text-amber-900">{formatCurrency(totalOutstanding)}</p>
                    <p className="text-xs text-amber-600">{activeLoans.length} active loans</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-violet-700 font-medium">Repayment Rate</p>
                    <p className="text-2xl font-bold text-violet-900">{repaymentRate.toFixed(0)}%</p>
                    <p className="text-xs text-violet-600">{onTimePayments} on-time payments</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-teal-700 font-medium">Completed Loans</p>
                    <p className="text-2xl font-bold text-teal-900">{completedLoans.length}</p>
                    <p className="text-xs text-teal-600">Successfully paid off</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-teal-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="analytics" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics & Trends
              </TabsTrigger>
              <TabsTrigger value="details" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <User className="mr-2 h-4 w-4" />
                Personal Details
              </TabsTrigger>
              <TabsTrigger value="loans" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <CreditCard className="mr-2 h-4 w-4" />
                Loans ({customerLoans.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Wallet className="mr-2 h-4 w-4" />
                Payments ({customerPayments.length})
              </TabsTrigger>
            </TabsList>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Payment Trend Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Payment Trend (Last 8 Months)
                    </CardTitle>
                    <CardDescription>Expected vs actual payments over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={paymentTrend}>
                        <defs>
                          <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="expected"
                          name="Expected"
                          stroke="#0d9488"
                          strokeWidth={2}
                          fill="url(#colorExpected)"
                        />
                        <Area
                          type="monotone"
                          dataKey="actual"
                          name="Actual"
                          stroke="#0891b2"
                          strokeWidth={2}
                          fill="url(#colorActual)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Credit Score History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-5 w-5 text-violet-600" />
                      Credit Score History
                    </CardTitle>
                    <CardDescription>Score progression over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={creditHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis domain={[300, 850]} tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                        <Line
                          type="monotone"
                          dataKey="score"
                          name="Credit Score"
                          stroke="#8b5cf6"
                          strokeWidth={3}
                          dot={{ fill: "#8b5cf6", r: 4 }}
                          activeDot={{ r: 6, fill: "#7c3aed" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-4 flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <span className="text-xs text-muted-foreground">Poor (300-579)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-amber-500" />
                        <span className="text-xs text-muted-foreground">Fair (580-669)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                        <span className="text-xs text-muted-foreground">Good (670-850)</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Loan Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieChart className="h-5 w-5 text-cyan-600" />
                      Loan Distribution by Product
                    </CardTitle>
                    <CardDescription>Breakdown of loans by product type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <RechartsPie>
                        <Pie
                          data={loanDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={{ stroke: "#6b7280" }}
                        >
                          {loanDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* On-Time Payment Rate */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Payment Performance
                    </CardTitle>
                    <CardDescription>On-time payment rate by month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={paymentTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#6b7280" tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                        <Bar dataKey="onTime" name="On-Time Rate" radius={[4, 4, 0, 0]}>
                          {paymentTrend.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.onTime >= 90 ? "#10b981" : entry.onTime >= 70 ? "#f59e0b" : "#ef4444"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Customer Summary Report */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5 text-primary" />
                    Customer Summary Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Loan History</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Loans Taken</span>
                          <span className="font-semibold">{customerLoans.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Active Loans</span>
                          <span className="font-semibold text-cyan-600">{activeLoans.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Completed Loans</span>
                          <span className="font-semibold text-emerald-600">{completedLoans.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Defaulted Loans</span>
                          <span className="font-semibold text-red-600">
                            {customerLoans.filter((l) => l.status === "defaulted").length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Payment Behavior</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Payments Made</span>
                          <span className="font-semibold">{customerPayments.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">On-Time Payments</span>
                          <span className="font-semibold text-emerald-600">{onTimePayments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Late Payments</span>
                          <span className="font-semibold text-amber-600">{customerPayments.length - onTimePayments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg Days to Payment</span>
                          <span className="font-semibold">5 days</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Risk Assessment</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk Grade</span>
                          <Badge className={`${risk.bgColor} ${risk.color} border-0`}>{customer.risk_grade}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Credit Score</span>
                          <span className="font-semibold">{customer.credit_score || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Income Verified</span>
                          <span className={customer.income_verified ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                            {customer.income_verified ? "Yes" : "No"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Relationship Age</span>
                          <span className="font-semibold">
                            {Math.floor((new Date().getTime() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))} months
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Personal Details Tab */}
            <TabsContent value="details" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Contact Information */}
                <Card>
                  <CardHeader className="bg-slate-50 rounded-t-lg">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-cyan-600" />
                      </div>
                      <div>
                        <p className="font-medium">{customer.phone_primary}</p>
                        {customer.phone_secondary && (
                          <p className="text-sm text-muted-foreground">{customer.phone_secondary}</p>
                        )}
                      </div>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
                          <Mail className="h-4 w-4 text-violet-600" />
                        </div>
                        <p>{customer.email}</p>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p>{customer.physical_address}</p>
                        <p className="text-sm text-muted-foreground">
                          {customer.ward}, {customer.district}, {customer.region}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Personal Information */}
                <Card>
                  <CardHeader className="bg-slate-50 rounded-t-lg">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">National ID</span>
                      <span className="font-mono text-sm">{customer.national_id}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Date of Birth</span>
                      <span>{formatDate(customer.date_of_birth)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Gender</span>
                      <span className="capitalize">{customer.gender}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Customer Since</span>
                      <span>{formatDate(customer.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Employment/Business Information */}
                <Card>
                  <CardHeader className="bg-slate-50 rounded-t-lg">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      {customer.customer_type === "business" ? "Business" : "Employment"} Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Type</span>
                      <span className="capitalize">{customer.employment_type.replace("_", " ")}</span>
                    </div>
                    {customer.employer_name && (
                      <div className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-muted-foreground">Employer</span>
                        <span>{customer.employer_name}</span>
                      </div>
                    )}
                    {customer.job_title && (
                      <div className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-muted-foreground">Position</span>
                        <span>{customer.job_title}</span>
                      </div>
                    )}
                    {customer.business_name && (
                      <>
                        <div className="flex justify-between py-2 border-b border-dashed">
                          <span className="text-muted-foreground">Business Name</span>
                          <span>{customer.business_name}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-dashed">
                          <span className="text-muted-foreground">Business Type</span>
                          <span>{customer.business_type}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-lg">
                      <span className="text-emerald-700">Monthly Income</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(customer.monthly_income)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Next of Kin */}
                <Card>
                  <CardHeader className="bg-slate-50 rounded-t-lg">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Next of Kin
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Name</span>
                      <span>{customer.next_of_kin_name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Relationship</span>
                      <span>{customer.next_of_kin_relationship}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Phone</span>
                      <span>{customer.next_of_kin_phone}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Address</span>
                      <span>{customer.next_of_kin_address}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Loans Tab */}
            <TabsContent value="loans">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Loan Number</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Maturity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerLoans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            No loans found for this customer
                          </TableCell>
                        </TableRow>
                      ) : (
                        customerLoans.map((loan) => {
                          const product = getProductById(loan.product_id);
                          const status = loanStatusConfig[loan.status];
                          const progress = (loan.total_paid / loan.total_amount) * 100;
                          return (
                            <TableRow key={loan.id} className="hover:bg-slate-50">
                              <TableCell className="font-mono text-sm">{loan.loan_number}</TableCell>
                              <TableCell>{product?.name}</TableCell>
                              <TableCell className="text-right">{formatCurrency(loan.principal_amount)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(loan.total_outstanding)}</TableCell>
                              <TableCell>
                                <div className="w-28">
                                  <Progress value={progress} className="h-2" />
                                  <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(0)}% paid</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={status.variant} className={status.variant === "default" ? "bg-emerald-600" : ""}>
                                  {status.label}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(loan.maturity_date)}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Allocation</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            No payments found
                          </TableCell>
                        </TableRow>
                      ) : (
                        customerPayments.map((payment) => (
                          <TableRow key={payment.id} className="hover:bg-slate-50">
                            <TableCell className="font-mono text-sm">{payment.payment_number}</TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {payment.payment_method.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs space-y-0.5">
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Principal:</span>
                                  <span>{formatCurrency(payment.principal_allocated)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Interest:</span>
                                  <span>{formatCurrency(payment.interest_allocated)}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={payment.status === "completed" ? "default" : "secondary"}
                                className={payment.status === "completed" ? "bg-emerald-600" : ""}
                              >
                                {payment.status === "completed" ? (
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                ) : (
                                  <Clock className="mr-1 h-3 w-3" />
                                )}
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDateTime(payment.payment_date)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
