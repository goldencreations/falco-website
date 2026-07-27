"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
 ArrowLeft,
 Phone,
 Mail,
 MapPin,
 Building2,
 User,
 Briefcase,
 Calendar,
  Home,
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
  Loader2,
  Paperclip,
  BarChart3,
  Users,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customerDisplayPhones } from "@/lib/customer-phones";
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
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { CustomerCollateralPanel } from "@/components/customers/customer-collateral-panel";
import { CustomerGuarantorPanel } from "@/components/customers/customer-guarantor-panel";
import { CustomerLocationCard } from "@/components/customers/customer-location-card";
import { CustomerLocationPhotosGrid } from "@/components/customers/customer-location-photos-grid";
import { CustomerSupportingDocumentsList } from "@/components/customers/customer-supporting-documents-list";
import { CustomerProfileStatCard } from "@/components/customers/customer-profile-stat-card";
import { enrichCustomerApplicationsForMedia } from "@/lib/enrich-customer-applications";
import {
 buildCustomerProfileAttachments,
 hasCustomerProfileAttachmentData,
} from "@/lib/customer-profile-attachments";
import type { ApplicationViewRow } from "@/lib/application-adapters";
import {
 buildCustomerCollateralRows,
 buildCustomerGuarantorRows,
 extractPassportPhotoPreviewUrl,
 extractPassportPhotoUrl,
} from "@/lib/customer-profile-extras";
import {
 getCachedCustomerDetail,
 setCachedCustomerDetail,
} from "@/lib/customer-detail-cache";
import {
 getCachedCustomerPortfolio,
 setCachedCustomerPortfolio,
} from "@/lib/customer-portfolio-cache";
import { resolveMediaViewUrl } from "@/components/media/cached-media-preview";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { customerToFormPayload } from "@/lib/customer-payload";
import type { CustomerPortfolioData } from "@/lib/customer-portfolio-detail";
import { formatReferenceRelationship } from "@/lib/customer-references";
import type { LoanListRow } from "@/lib/loan-adapters";
import { useSessionUser } from "@/lib/use-session-user";
import type { Customer, Payment, RiskGrade, LoanStatus } from "@/lib/types";

const riskGradeConfig: Record<RiskGrade, { label: string; color: string; bgColor: string }> = {
 A: { label: "Grade A - Low Risk", color: "text-emerald-700", bgColor: "bg-emerald-100" },
 B: { label: "Grade B - Moderate Risk", color: "text-cyan-700", bgColor: "bg-cyan-100" },
 C: { label: "Grade C - Average Risk", color: "text-amber-700", bgColor: "bg-amber-100" },
 D: { label: "Grade D - High Risk", color: "text-orange-700", bgColor: "bg-orange-100" },
 E: { label: "Grade E - Very High Risk", color: "text-red-700", bgColor: "bg-red-100" },
};

const loanStatusConfig: Record<LoanStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
 draft: { label: "Draft", variant: "outline", color: "bg-slate-400" },
 pending_disbursement: { label: "Pending", variant: "secondary", color: "bg-slate-500" },
 active: { label: "Active", variant: "default", color: "bg-emerald-500" },
 in_arrears: { label: "In Arrears", variant: "destructive", color: "bg-amber-500" },
 defaulted: { label: "Defaulted", variant: "destructive", color: "bg-red-500" },
 written_off: { label: "Written Off", variant: "outline", color: "bg-slate-800" },
 paid_off: { label: "Paid Off", variant: "default", color: "bg-cyan-500" },
 restructured: { label: "Restructured", variant: "secondary", color: "bg-purple-500" },
};

function TabPanelSkeleton() {
 return (
 <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Loading…
 </div>
 );
}

const CustomerAnalyticsTab = dynamic(
 () =>
 import("@/components/customers/customer-analytics-tab").then((m) => ({
 default: m.CustomerAnalyticsTab,
 })),
 { loading: () => <TabPanelSkeleton /> }
);

const CustomerAttachmentsDisplay = dynamic(
 () =>
 import("@/components/customers/customer-attachments-display").then((m) => ({
 default: m.CustomerAttachmentsDisplay,
 })),
 { loading: () => <TabPanelSkeleton /> }
);

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

export default function CustomerDetailPage() {
 const { id: customerId } = useParams<{ id: string }>();
 const { user } = useSessionUser();
 const customersListPath =
 user?.role === "branch_manager"
 ? "/manager/customers"
 : user?.role === "loan_officer"
 ? "/officer/customers"
 : "/customers";
 const customerEditPath =
 user?.role === "branch_manager"
 ? `/manager/customers/${customerId}/edit`
 : user?.role === "loan_officer"
 ? `/officer/customers/${customerId}/edit`
 : `/customers/${customerId}/edit`;
 const [isExporting, setIsExporting] = useState(false);
 const [customer, setCustomer] = useState<Customer | null>(null);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState("");
 const [portfolioLoading, setPortfolioLoading] = useState(true);
 const [portfolioError, setPortfolioError] = useState("");
 const [customerLoans, setCustomerLoans] = useState<LoanListRow[]>([]);
 const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
 const [paymentTrend, setPaymentTrend] = useState<CustomerPortfolioData["paymentTrend"]>([]);
 const [loanDistribution, setLoanDistribution] = useState<CustomerPortfolioData["loanDistribution"]>([]);
 const [creditHistory, setCreditHistory] = useState<CustomerPortfolioData["creditHistory"]>([]);
 const [balanceSnapshot, setBalanceSnapshot] = useState<CustomerPortfolioData["balanceSnapshot"]>([]);
 const [applicationCount, setApplicationCount] = useState(0);
 const [customerApplications, setCustomerApplications] = useState<ApplicationViewRow[]>([]);
 const [mediaEnrichedApplications, setMediaEnrichedApplications] = useState<ApplicationViewRow[]>(
  []
 );
 const [mediaEnriching, setMediaEnriching] = useState(false);
 const [sourceRow, setSourceRow] = useState<Record<string, unknown> | null>(null);
 const [blacklistOpen, setBlacklistOpen] = useState(false);
 const [blacklistReason, setBlacklistReason] = useState("");
 const [blacklistSaving, setBlacklistSaving] = useState(false);
 const [blacklistError, setBlacklistError] = useState("");
 const [activeTab, setActiveTab] = useState("analytics");
 const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set(["analytics"]));

 const handleTabChange = useCallback((value: string) => {
 setActiveTab(value);
 setMountedTabs((prev) => {
 if (prev.has(value)) return prev;
 const next = new Set(prev);
 next.add(value);
 return next;
 });
 }, []);

 const applicationsForFiles =
 mediaEnrichedApplications.length > 0 ? mediaEnrichedApplications : customerApplications;

 const customerAttachments = useMemo(
 () => buildCustomerProfileAttachments(sourceRow, applicationsForFiles),
 [sourceRow, applicationsForFiles]
 );
 const passportPhotoUrl = useMemo(() => extractPassportPhotoUrl(sourceRow), [sourceRow]);
 const passportPhotoPreviewUrl = useMemo(
 () => extractPassportPhotoPreviewUrl(sourceRow),
 [sourceRow]
 );
 const passportAvatarSrc = useMemo(
 () => resolveMediaViewUrl(passportPhotoPreviewUrl, passportPhotoUrl),
 [passportPhotoPreviewUrl, passportPhotoUrl]
 );
 const collateralRows = useMemo(
  () => buildCustomerCollateralRows(sourceRow, applicationsForFiles),
  [sourceRow, applicationsForFiles]
 );
 const guarantorRows = useMemo(
  () => buildCustomerGuarantorRows(customer?.guarantors, applicationsForFiles, sourceRow),
  [customer?.guarantors, applicationsForFiles, sourceRow]
 );

 const applyPortfolio = (body: CustomerPortfolioData) => {
 setCustomerLoans(body.loans ?? []);
 setCustomerPayments(body.payments ?? []);
 setPaymentTrend(body.paymentTrend ?? []);
 setLoanDistribution(body.loanDistribution ?? []);
 setCreditHistory(body.creditHistory ?? []);
 setBalanceSnapshot(body.balanceSnapshot ?? []);
 setApplicationCount(body.applications?.length ?? 0);
 setCustomerApplications(body.applications ?? []);
 };

 useEffect(() => {
 if (!customerId) return;
 let cancelled = false;
 const id = customerId;

 const cachedCustomer = getCachedCustomerDetail(id);
 const cachedPortfolio = getCachedCustomerPortfolio(id);

 if (cachedCustomer) {
 setSourceRow(cachedCustomer.row);
 setCustomer(cachedCustomer.customer);
 setLoading(false);
 }
 if (cachedPortfolio) {
 applyPortfolio(cachedPortfolio);
 setPortfolioLoading(false);
 }

 if (!cachedCustomer) setLoading(true);
 if (!cachedPortfolio) setPortfolioLoading(true);
 setLoadError("");
 setPortfolioError("");

 const loadCustomer = async () => {
 try {
 const customerRes = await fetch(`/api/customers/${encodeURIComponent(id)}`, {
 credentials: "include",
 });
 const customerBody = (await customerRes.json().catch(() => ({}))) as { message?: string };
 if (cancelled) return;

 if (!customerRes.ok) {
 setLoadError(
 typeof customerBody.message === "string"
 ? customerBody.message
 : `Could not load customer (${customerRes.status})`
 );
 setCustomer(null);
 setSourceRow(null);
 return;
 }

 const row = extractCustomerDetail(customerBody);
 if (!row) {
 setLoadError("Customer details could not be loaded. Please try again.");
 setCustomer(null);
 setSourceRow(null);
 return;
 }

 const nextCustomer = adaptApiCustomerRowToCustomer(row);
 setSourceRow(row);
 setCustomer(nextCustomer);
 setCachedCustomerDetail(id, row, nextCustomer);
 } catch {
 if (!cancelled && !cachedCustomer) setLoadError("Network error");
 } finally {
 if (!cancelled) setLoading(false);
 }
 };

 const loadPortfolio = async () => {
 try {
 const portfolioRes = await fetch(`/api/customers/${encodeURIComponent(id)}/portfolio`, {
 credentials: "include",
 });
 const portfolioBody = (await portfolioRes.json().catch(() => ({}))) as CustomerPortfolioData & {
 message?: string;
 };
 if (cancelled) return;

 if (!portfolioRes.ok) {
 if (!cachedPortfolio) {
 setPortfolioError(
 typeof portfolioBody.message === "string"
 ? portfolioBody.message
 : "Could not load loan portfolio"
 );
 setCustomerLoans([]);
 setCustomerPayments([]);
 setApplicationCount(0);
 setCustomerApplications([]);
 }
 return;
 }

 setCachedCustomerPortfolio(id, portfolioBody);
 applyPortfolio(portfolioBody);
 setPortfolioError("");
 } catch {
 if (!cancelled && !cachedPortfolio) {
 setPortfolioError("Network error loading portfolio");
 setCustomerLoans([]);
 setCustomerPayments([]);
 }
 } finally {
 if (!cancelled) setPortfolioLoading(false);
 }
 };

 void loadCustomer();
 void loadPortfolio();

 return () => {
 cancelled = true;
 };
 }, [customerId]);

 useEffect(() => {
 if (customerApplications.length === 0) {
 setMediaEnrichedApplications([]);
 setMediaEnriching(false);
 return;
 }
 let cancelled = false;
 setMediaEnriching(true);
 void enrichCustomerApplicationsForMedia(customerApplications).then((enriched) => {
 if (!cancelled) {
 setMediaEnrichedApplications(enriched);
 setMediaEnriching(false);
 }
 });
 return () => {
 cancelled = true;
 };
 }, [customerApplications]);

 if (loading) {
 return (
 <>
 <DashboardHeader title="Customer" description="Loading customer profile…" />
 <main className="flex min-h-0 flex-1 overflow-y-auto p-6">
 <p className="text-muted-foreground">Loading…</p>
 </main>
 </>
 );
 }

 if (loadError || !customer) {
 return (
 <>
 <DashboardHeader title="Customer Not Found" />
 <main className="flex min-h-0 flex-1 overflow-y-auto p-6">
 <div className="text-center py-12">
 <p className="text-muted-foreground">{loadError || "Customer not found"}</p>
 <Button asChild className="mt-4">
 <Link href={customersListPath}>Back to Customers</Link>
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
 const response = await fetch(`/api/customers/${customerId}/export`, {
 credentials: "include",
 });
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
 doc.text("Falco Financial Services — customer portfolio report", 14, doc.internal.pageSize.getHeight() - 6);
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

 const handleBlacklistConfirm = async () => {
 setBlacklistSaving(true);
 setBlacklistError("");
 try {
 const body = {
 ...customerToFormPayload(customer, sourceRow),
 is_blacklisted: true,
 blacklist_reason: blacklistReason.trim() || undefined,
 };
 const r = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });
 const j = (await r.json().catch(() => ({}))) as { message?: string };
 if (!r.ok) {
 setBlacklistError(typeof j.message === "string" ? j.message : `Blacklist failed (${r.status})`);
 return;
 }
 const row = extractCustomerDetail(j);
 if (row) {
 setCustomer(adaptApiCustomerRowToCustomer(row));
 setSourceRow(row);
 }
 setBlacklistOpen(false);
 setBlacklistReason("");
 } catch {
 setBlacklistError("Network error. Try again.");
 } finally {
 setBlacklistSaving(false);
 }
 };

 return (
 <>
 <DashboardHeader
 title="Customer Profile"
 description={customer.customer_number}
 />
 <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-3 pb-10 sm:p-4 lg:p-6 lg:pb-8">
 <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <Button variant="ghost" size="sm" className="w-fit" asChild>
 <Link href={customersListPath}>
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Customers
 </Link>
 </Button>
 <div className="grid w-full grid-cols-2 gap-2 min-[520px]:flex min-[520px]:w-auto min-[520px]:flex-wrap min-[520px]:justify-end">
 <Button variant="outline" size="sm" className="justify-center" onClick={handleExportPdf} disabled={isExporting}>
 <Download className="mr-2 h-4 w-4" />
 <span className="truncate">{isExporting ? "Exporting..." : "Export Report"}</span>
 </Button>
 <Button variant="outline" size="sm" className="justify-center" asChild>
 <Link href={customerEditPath}>
 <Edit className="mr-2 h-4 w-4" />
 Edit
 </Link>
 </Button>
 {!customer.is_blacklisted && (
 <Button
 variant="destructive"
 size="sm"
 className="col-span-2 justify-center min-[520px]:col-auto"
 onClick={() => {
 setBlacklistError("");
 setBlacklistOpen(true);
 }}
 >
 <Ban className="mr-2 h-4 w-4" />
 Blacklist
 </Button>
 )}
 </div>
 </div>

 {/* Customer Header Card */}
 <Card className="overflow-hidden border border-border/80 shadow-sm">
 <CardContent className="p-4 sm:p-5">
 <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
 <Avatar className="h-32 w-32 shrink-0 ring-2 ring-primary/15 sm:h-40 sm:w-40">
          {passportAvatarSrc ? (
            <AvatarImage
              src={passportAvatarSrc}
              alt={`${customer.first_name} ${customer.last_name}`}
              className="object-cover"
              loading="lazy"
            />
          ) : null}
 <AvatarFallback className="bg-primary text-primary-foreground text-4xl font-bold sm:text-5xl">
 {customer.first_name[0]}
 {customer.last_name[0]}
 </AvatarFallback>
 </Avatar>
 <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
 <div>
 <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
 <h2 className="max-w-full break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
 {customer.first_name} {customer.middle_name} {customer.last_name}
 </h2>
 {customer.is_blacklisted && (
 <Badge variant="destructive" className="bg-red-600">
 <AlertTriangle className="mr-1 h-3 w-3" />
 Blacklisted
 </Badge>
 )}
 </div>
 <p className="break-all font-mono text-sm text-muted-foreground">{customer.customer_number}</p>
 </div>
 <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
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

 {portfolioError ? (
 <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
 {portfolioError}
 </div>
 ) : null}

 {portfolioLoading ? (
 <p className="text-sm text-muted-foreground">Loading loans and payment history…</p>
 ) : null}

 {/* Key Metrics */}
 <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
 <CustomerProfileStatCard
 title="Total borrowed"
 value={formatCurrency(totalBorrowed)}
 hint={`${customerLoans.length} loans`}
 icon={Wallet}
 tone="cyan"
 />
 <CustomerProfileStatCard
 title="Total repaid"
 value={formatCurrency(totalPaid)}
 hint={
 <span className="inline-flex items-center gap-1">
 <TrendingUp className="h-3 w-3 shrink-0" />
 {totalBorrowed > 0
 ? `${((totalPaid / (totalBorrowed + totalBorrowed * 0.15)) * 100).toFixed(0)}% repaid`
 : "0% repaid"}
 </span>
 }
 icon={CheckCircle2}
 tone="emerald"
 />
 <CustomerProfileStatCard
 title="Outstanding"
 value={formatCurrency(totalOutstanding)}
 hint={`${activeLoans.length} active loans`}
 icon={Clock}
 tone="amber"
 />
 <CustomerProfileStatCard
 title="Repayment rate"
 value={`${repaymentRate.toFixed(0)}%`}
 hint={`${onTimePayments} on-time payments`}
 icon={TrendingUp}
 tone="violet"
 />
 <CustomerProfileStatCard
 title="Completed loans"
 value={String(completedLoans.length)}
 hint="Successfully paid off"
 icon={CreditCard}
 tone="teal"
 />
 </div>

 <CustomerLocationCard customer={customer} />

 {/* Tabs */}
 <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
 <div className="-mx-4 overflow-x-auto px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
 <TabsList className="flex h-auto w-max min-w-full flex-nowrap justify-start gap-1 bg-muted/50 p-1 sm:w-full sm:flex-wrap">
 <TabsTrigger
 value="analytics"
 className="shrink-0 flex-none px-2.5 py-2 text-xs sm:flex-1 sm:px-3 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
 >
<BarChart3 className="mr-1.5 h-4 w-4 sm:mr-2" />
<span className="sm:hidden">Analytics</span>
<span className="hidden sm:inline">Analytics & Trends</span>
</TabsTrigger>
 <TabsTrigger
 value="details"
 className="shrink-0 flex-none px-2.5 py-2 text-xs sm:flex-1 sm:px-3 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
 >
 <User className="mr-1.5 h-4 w-4 sm:mr-2" />
 <span className="sm:hidden">Details</span>
 <span className="hidden sm:inline">Personal Details</span>
 </TabsTrigger>
 <TabsTrigger
 value="loans"
 className="shrink-0 flex-none px-2.5 py-2 text-xs sm:flex-1 sm:px-3 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
 >
 <CreditCard className="mr-1.5 h-4 w-4 sm:mr-2" />
 Loans ({customerLoans.length})
 </TabsTrigger>
 <TabsTrigger
 value="payments"
 className="shrink-0 flex-none px-2.5 py-2 text-xs sm:flex-1 sm:px-3 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
 >
 <Wallet className="mr-1.5 h-4 w-4 sm:mr-2" />
 Payments ({customerPayments.length})
 </TabsTrigger>
 <TabsTrigger
 value="attachments"
 className="shrink-0 flex-none px-2.5 py-2 text-xs sm:flex-1 sm:px-3 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
 >
 <Paperclip className="mr-1.5 h-4 w-4 sm:mr-2" />
 <span className="sm:hidden">Files</span>
 <span className="hidden sm:inline">Attachment / Uploads</span>
 </TabsTrigger>
 <TabsTrigger
 value="collateral"
 className="shrink-0 flex-none px-2.5 py-2 text-xs sm:flex-1 sm:px-3 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
 >
 <Shield className="mr-1.5 h-4 w-4 sm:mr-2" />
 Collateral
 </TabsTrigger>
 <TabsTrigger
 value="guarantors"
 className="shrink-0 flex-none px-2.5 py-2 text-xs sm:flex-1 sm:px-3 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
 >
 <Users className="mr-1.5 h-4 w-4 sm:mr-2" />
 <span className="sm:hidden">Guarantor</span>
 <span className="hidden sm:inline">Guarantor Details & Attachment</span>
 </TabsTrigger>
 </TabsList>
 </div>

 {/* Analytics Tab */}
 <TabsContent value="analytics" className="space-y-6">
 {mountedTabs.has("analytics") ? (
 <CustomerAnalyticsTab
 paymentTrend={paymentTrend}
 creditHistory={creditHistory}
 balanceSnapshot={balanceSnapshot}
 loanDistribution={loanDistribution}
 customerLoans={customerLoans}
 customerPayments={customerPayments}
 applicationCount={applicationCount}
 activeLoans={activeLoans}
 completedLoans={completedLoans}
 onTimePayments={onTimePayments}
 customer={customer}
 risk={risk}
 portfolioLoading={portfolioLoading}
 />
 ) : null}
 </TabsContent>

 {/* Personal Details Tab */}
 <TabsContent value="details" className="space-y-6">
 {mountedTabs.has("details") ? (
 <div className="grid gap-6 md:grid-cols-2">
 {/* Home Information */}
 <Card>
 <CardHeader className="bg-slate-50 rounded-t-lg">
 <CardTitle className="text-base flex items-center gap-2">
 <Home className="h-4 w-4 text-primary" />
 Home Information
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4 pt-4">
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
 <CustomerLocationPhotosGrid
 photos={customerAttachments.homeLocationPhotos}
 label="Home location photos"
 />
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
 <div className="flex items-center gap-3 pb-2 border-b border-dashed">
 <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center">
 <Phone className="h-4 w-4 text-cyan-600" />
 </div>
 <div>
 {customerDisplayPhones(customer).map((phone, index) => (
 <p
 key={`${phone}-${index}`}
 className={index === 0 ? "font-medium" : "text-sm text-muted-foreground"}
 >
 {phone}
 </p>
 ))}
 {customerDisplayPhones(customer).length === 0 ? (
 <p className="font-medium text-muted-foreground">—</p>
 ) : null}
 </div>
 </div>
 {customer.email ? (
 <div className="flex items-center gap-3 pb-2 border-b border-dashed">
 <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
 <Mail className="h-4 w-4 text-violet-600" />
 </div>
 <p>{customer.email}</p>
 </div>
 ) : null}
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
 <CustomerSupportingDocumentsList documents={customerAttachments.supportingDocuments} />
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
 {customer.business_address ? (
 <div className="space-y-1 py-2 border-b border-dashed">
 <span className="text-muted-foreground">Business Address</span>
 <p className="text-sm leading-relaxed">{customer.business_address}</p>
 </div>
 ) : null}
 </>
 )}
 <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-lg">
 <span className="text-emerald-700">Monthly Income</span>
 <span className="font-bold text-emerald-700">{formatCurrency(customer.monthly_income)}</span>
 </div>
 <CustomerLocationPhotosGrid
 photos={customerAttachments.businessLocationPhotos}
 label="Business location photos"
 />
 </CardContent>
 </Card>

 {customer.references && customer.references.length > 0 ? (
 <Card className="md:col-span-2">
 <CardHeader className="bg-slate-50 rounded-t-lg">
 <CardTitle className="text-base flex items-center gap-2">
 <Users className="h-4 w-4 text-primary" />
 References
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 pt-4">
 {customer.references.map((reference, index) => (
 <div
 key={`${reference.full_name}-${index}`}
 className="rounded-lg border border-dashed px-3 py-2 text-sm"
 >
 <p className="font-medium">{reference.full_name}</p>
 <p className="text-muted-foreground">
 {[
   reference.sex
     ? reference.sex.charAt(0).toUpperCase() + reference.sex.slice(1)
     : null,
   formatReferenceRelationship(reference.relationship),
   reference.phone,
 ]
   .filter(Boolean)
   .join(" · ")}
 </p>
 {reference.address ? (
 <p className="text-xs text-muted-foreground">{reference.address}</p>
 ) : null}
 </div>
 ))}
 </CardContent>
 </Card>
 ) : null}

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
 ) : null}
 </TabsContent>

 {/* Loans Tab */}
 <TabsContent value="loans">
 {mountedTabs.has("loans") ? (
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
 const productLabel = loan.productName || loan.product_id || "—";
 const status = loanStatusConfig[loan.status];
 const progress =
 loan.total_amount > 0 ? Math.min(100, (loan.total_paid / loan.total_amount) * 100) : 0;
 return (
 <TableRow key={loan.id} className="hover:bg-slate-50">
 <TableCell className="font-mono text-sm">{loan.loan_number}</TableCell>
 <TableCell>{productLabel}</TableCell>
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
 ) : null}
 </TabsContent>

 {/* Payments Tab */}
 <TabsContent value="payments">
 {mountedTabs.has("payments") ? (
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
 ) : null}
 </TabsContent>

 <TabsContent value="attachments">
 {mountedTabs.has("attachments") ? (
 mediaEnriching && !hasCustomerProfileAttachmentData(customerAttachments) ? (
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Attachment / Uploads</CardTitle>
 <CardDescription>Loading files from loan applications…</CardDescription>
 </CardHeader>
 <CardContent>
 <TabPanelSkeleton />
 </CardContent>
 </Card>
 ) : hasCustomerProfileAttachmentData(customerAttachments) ? (
 <CustomerAttachmentsDisplay attachments={customerAttachments} />
 ) : (
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Attachment / Uploads</CardTitle>
 <CardDescription>No attachment files on record for this customer yet.</CardDescription>
 </CardHeader>
 <CardContent>
 <p className="text-sm text-muted-foreground">
 Upload home/business photos and supporting documents when creating or editing the customer,
 or add collateral and guarantor files on a loan application.
 </p>
 </CardContent>
 </Card>
 )
 ) : null}
 </TabsContent>

 <TabsContent value="collateral">
 {mountedTabs.has("collateral") ? <CustomerCollateralPanel rows={collateralRows} /> : null}
 </TabsContent>

 <TabsContent value="guarantors">
 {mountedTabs.has("guarantors") ? <CustomerGuarantorPanel rows={guarantorRows} /> : null}
 </TabsContent>
 </Tabs>
 </div>
 </main>

 <AlertDialog
 open={blacklistOpen}
 onOpenChange={(o) => {
 setBlacklistOpen(o);
 if (!o) {
 setBlacklistError("");
 setBlacklistReason("");
 }
 }}
 >
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Blacklist this customer?</AlertDialogTitle>
 <AlertDialogDescription>
 This marks the customer as blacklisted. You can add an internal reason below.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <div className="space-y-2 py-2">
 <Label htmlFor="blacklist-reason">Reason (optional)</Label>
 <Textarea
 id="blacklist-reason"
 value={blacklistReason}
 onChange={(e) => setBlacklistReason(e.target.value)}
 rows={3}
 placeholder="e.g. Fraudulent documents, repeated default…"
 />
 {blacklistError ? <p className="text-sm text-destructive">{blacklistError}</p> : null}
 </div>
 <AlertDialogFooter>
 <AlertDialogCancel disabled={blacklistSaving}>Cancel</AlertDialogCancel>
 <Button
 type="button"
 variant="destructive"
 disabled={blacklistSaving}
 onClick={() => void handleBlacklistConfirm()}
 >
 {blacklistSaving ? "Saving…" : "Confirm blacklist"}
 </Button>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </>
 );
}
