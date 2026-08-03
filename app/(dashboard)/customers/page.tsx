"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
 Plus,
 Search,
 Filter,
 Eye,
 Phone,
 Mail,
 MapPin,
 Building2,
 User,
 AlertTriangle,
 Trash2,
} from "lucide-react";
import { DeleteCustomerDialog } from "@/components/customers/delete-customer-dialog";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveMediaViewUrl } from "@/components/media/cached-media-preview";
import { extractCustomersList } from "@/lib/customer-adapters";
import { addHiddenCustomerId, getHiddenCustomerIds } from "@/lib/customer-hidden-client";
import { customerDisplayPhones } from "@/lib/customer-phones";
import { useTranslations } from "@/lib/i18n/use-translations";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { formatApiResponseError } from "@/lib/falco-api";
import { extractLoansList, type LoanListRow } from "@/lib/loan-adapters";
import { daysUntilDate, earliestDueDate } from "@/lib/loan-due-date";
import type { Customer, RiskGrade } from "@/lib/types";
import { useSessionUser } from "@/lib/use-session-user";

const riskGradeConfig: Record<RiskGrade, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
 A: { label: "Grade A", variant: "default" },
 B: { label: "Grade B", variant: "secondary" },
 C: { label: "Grade C", variant: "outline" },
 D: { label: "Grade D", variant: "destructive" },
 E: { label: "Grade E", variant: "destructive" },
};

type CustomerLoanStatus = {
 count: number;
 outstanding: number;
 penalty: number;
 tone: "none" | "green" | "yellow" | "red";
 label: string;
 nextDueDate?: string;
};

const ACTIVE_LOAN_STATUSES = new Set(["active", "in_arrears"]);

function customerLoanStatus(loans: LoanListRow[]): CustomerLoanStatus {
 const active = loans.filter((loan) => ACTIVE_LOAN_STATUSES.has(loan.status));
 if (active.length === 0) {
  return { count: 0, outstanding: 0, penalty: 0, tone: "none", label: "No active loan" };
 }

 const outstanding = active.reduce((sum, loan) => sum + loan.total_outstanding, 0);
 const penalty = active.reduce((sum, loan) => sum + (loan.penalty_outstanding ?? loan.penalty ?? 0), 0);
 const nextDueDate = earliestDueDate(active);
 const dueInDays = daysUntilDate(nextDueDate);
 const overdue = active.some((loan) => loan.days_in_arrears > 0);

 if (overdue) {
  return { count: active.length, outstanding, penalty, tone: "red", label: "Payment overdue", nextDueDate };
 }
 if (dueInDays != null && dueInDays >= 0 && dueInDays <= 3) {
  return { count: active.length, outstanding, penalty, tone: "yellow", label: "Payment due soon", nextDueDate };
 }
 return { count: active.length, outstanding, penalty, tone: "green", label: "Active loan", nextDueDate };
}

function statusClasses(tone: CustomerLoanStatus["tone"]) {
 switch (tone) {
  case "red":
   return "border-l-4 border-l-red-500 bg-red-50/60 hover:bg-red-50";
  case "yellow":
   return "border-l-4 border-l-amber-400 bg-amber-50/70 hover:bg-amber-50";
  case "green":
   return "border-l-4 border-l-emerald-500 bg-emerald-50/50 hover:bg-emerald-50";
  default:
   return "";
 }
}

function statusBadgeClasses(tone: CustomerLoanStatus["tone"]) {
 switch (tone) {
  case "red":
   return "border-red-200 bg-red-100 text-red-800";
  case "yellow":
   return "border-amber-200 bg-amber-100 text-amber-900";
  case "green":
   return "border-emerald-200 bg-emerald-100 text-emerald-800";
  default:
   return "border-muted bg-muted/40 text-muted-foreground";
 }
}

export default function CustomersPage() {
 const { t } = useTranslations();
 const { user } = useSessionUser();
 const isManagerView = user?.role === "branch_manager";
 const isOfficerView = user?.role === "loan_officer";
 const isSuperAdmin = user?.role === "super_admin";
 const scopeBranchId = isManagerView || isOfficerView ? user?.branch_id : null;
 const customersBasePath = isManagerView ? "/manager/customers" : isOfficerView ? "/officer/customers" : "/customers";
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [loans, setLoans] = useState<LoanListRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState<string | null>(null);

 const loadCustomers = useCallback(async () => {
 setLoading(true);
 setLoadError(null);
 try {
 const params = new URLSearchParams();
 if (scopeBranchId) params.set("branch_id", scopeBranchId);
 params.set("page_size", "100");
 const useEnrichedList = isManagerView || (isSuperAdmin && scopeBranchId);
 const endpoint = useEnrichedList
 ? `/api/customers/with-assignments?${params.toString()}`
 : `/api/customers?${params.toString()}`;
 const res = await fetch(endpoint, { credentials: "include", cache: "no-store" });
 const json = (await res.json().catch(() => ({}))) as {
 customers?: Customer[];
 message?: string;
 };
 if (!res.ok) {
 throw new Error(formatApiResponseError(json, t("customers.loadError")));
 }
 const list = useEnrichedList && Array.isArray(json.customers)
 ? json.customers
 : extractCustomersList(json);
 setCustomers(list);
 } catch (e) {
 setCustomers([]);
 setLoadError(e instanceof Error ? e.message : t("customers.loadError"));
 } finally {
 setLoading(false);
 }
 }, [scopeBranchId, isManagerView, isSuperAdmin, t]);

 useEffect(() => {
 void loadCustomers();
 }, [loadCustomers]);

 useEffect(() => {
 let cancelled = false;
 const params = new URLSearchParams();
 params.set("page_size", "200");
 params.set("include_next_due", "1");
 if (scopeBranchId) params.set("branch_id", scopeBranchId);

 void fetch(`/api/loans?${params.toString()}`, { credentials: "include", cache: "no-store" })
 .then(async (res) => {
  if (!res.ok) return null;
  return res.json();
 })
 .then((json) => {
  if (!cancelled && json) setLoans(extractLoansList(json));
 })
 .catch(() => {
  if (!cancelled) setLoans([]);
 });

 return () => {
  cancelled = true;
 };
 }, [scopeBranchId]);

 const [searchQuery, setSearchQuery] = useState("");
 const [typeFilter, setTypeFilter] = useState<string>("all");
 const [riskFilter, setRiskFilter] = useState<string>("all");
 const [loanStatusFilter, setLoanStatusFilter] = useState<string>("all");
 const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [hiddenCustomerIds, setHiddenCustomerIds] = useState<Set<string>>(new Set());
 const [softDeleteNotice, setSoftDeleteNotice] = useState<string | null>(null);
 const visibleCustomers =
 scopeBranchId
 ? customers.filter(
     (customer) => customer.branch_id === scopeBranchId && !hiddenCustomerIds.has(customer.id)
   )
 : customers.filter((customer) => !hiddenCustomerIds.has(customer.id));

 useEffect(() => {
 setHiddenCustomerIds(getHiddenCustomerIds());
 }, []);

 const loanStatusByCustomer = useMemo(() => {
 const map = new Map<string, LoanListRow[]>();
 for (const loan of loans) {
  const id = loan.customer_id?.trim();
  if (!id) continue;
  const list = map.get(id) ?? [];
  list.push(loan);
  map.set(id, list);
 }
 return map;
 }, [loans]);

 const activeLoansForCustomer = (customerId: string) =>
 customerLoanStatus(loanStatusByCustomer.get(customerId) ?? []);

 const filteredCustomers = visibleCustomers.filter((customer) => {
 const loanStatus = activeLoansForCustomer(customer.id);
 const matchesSearch =
 searchQuery === "" ||
 customer.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 customer.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 customer.customer_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
 customer.phone_primary.includes(searchQuery) ||
 (customer.phone_numbers ?? []).some((phone) => phone.includes(searchQuery)) ||
 (customer.phone_secondary ?? "").includes(searchQuery) ||
 customer.national_id.includes(searchQuery);

 const matchesType = typeFilter === "all" || customer.customer_type === typeFilter;
 const matchesRisk = riskFilter === "all" || customer.risk_grade === riskFilter;
 const matchesLoanStatus =
 loanStatusFilter === "all" ||
 (loanStatusFilter === "due_soon" && loanStatus.tone === "yellow") ||
 (loanStatusFilter === "overdue" && loanStatus.tone === "red") ||
 (loanStatusFilter === "none" && loanStatus.tone === "none");

 return matchesSearch && matchesType && matchesRisk && matchesLoanStatus;
 });

 const totalCustomers = visibleCustomers.length;
 const individualCount = visibleCustomers.filter((c) => c.customer_type === "individual").length;
 const businessCount = visibleCustomers.filter((c) => c.customer_type === "business").length;
 const blacklistedCount = visibleCustomers.filter((c) => c.is_blacklisted).length;

 return (
 <>
 <DashboardHeader
 title={isOfficerView ? t("customers.titleOfficer") : t("customers.title")}
 description={isOfficerView ? t("customers.descriptionOfficer") : t("customers.description")}
 />
 <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-4 pb-10 lg:p-6 lg:pb-8">
 <div className="mx-auto w-full max-w-7xl space-y-6">
 {softDeleteNotice ? (
 <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
 {softDeleteNotice}
 </div>
 ) : null}
 {loadError ? (
 <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
 {loadError}
 </div>
 ) : null}
 <div className="p-4 sm:p-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
 {isOfficerView ? t("customers.portfolioOfficer") : t("customers.portfolio")}
 </p>
 <h2 className="mt-1 text-lg font-semibold tracking-tight">
 {isOfficerView ? t("customers.titleOfficer") : t("customers.subtitle")}
 </h2>
 <p className="mt-1 text-sm text-muted-foreground">
 {isOfficerView ? t("customers.subtitleOfficer") : t("customers.subtitle")}
 </p>
 </div>
 </div>
 </div>

 {loading ? (
 <p className="py-12 text-center text-sm text-muted-foreground">{t("customers.loading")}</p>
 ) : (
 <>
 {/* Summary Cards */}
 <Card className="border-emerald-100 bg-emerald-50/60 sm:hidden">
 <CardContent className="p-4">
 <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Customer Summary</p>
 <div className="mt-3 grid grid-cols-1 gap-3 text-sm min-[430px]:grid-cols-2">
 <div className="rounded-lg border bg-background p-3">
 <p className="text-xs text-muted-foreground">Total</p>
 <p className="text-lg font-semibold">{totalCustomers}</p>
 </div>
 <div className="rounded-lg border bg-background p-3">
 <p className="text-xs text-muted-foreground">Individual</p>
 <p className="text-lg font-semibold">{individualCount}</p>
 </div>
 <div className="rounded-lg border bg-background p-3">
 <p className="text-xs text-muted-foreground">Business</p>
 <p className="text-lg font-semibold">{businessCount}</p>
 </div>
 <div className="rounded-lg border border-destructive/20 bg-background p-3">
 <p className="text-xs text-muted-foreground">Blacklisted</p>
 <p className="text-lg font-semibold text-destructive">{blacklistedCount}</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
 <Card className="border-emerald-100 bg-emerald-50/40">
 <CardHeader className="min-h-16 pb-2">
 <CardTitle className="text-sm font-medium leading-snug text-muted-foreground">
 Total Customers
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-xl font-bold lg:text-2xl">{totalCustomers}</div>
 </CardContent>
 </Card>
 <Card className="border-emerald-100 bg-emerald-50/30">
 <CardHeader className="min-h-16 pb-2">
 <CardTitle className="flex items-center gap-2 text-sm font-medium leading-snug text-muted-foreground">
 <User className="h-4 w-4 text-emerald-700" />
 Individual
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-xl font-bold lg:text-2xl">{individualCount}</div>
 </CardContent>
 </Card>
 <Card className="border-emerald-100 bg-emerald-50/30">
 <CardHeader className="min-h-16 pb-2">
 <CardTitle className="flex items-center gap-2 text-sm font-medium leading-snug text-muted-foreground">
 <Building2 className="h-4 w-4 text-emerald-700" />
 Business
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-xl font-bold lg:text-2xl">{businessCount}</div>
 </CardContent>
 </Card>
 <Card className="border-destructive/20 bg-destructive/5">
 <CardHeader className="min-h-16 pb-2">
 <CardTitle className="flex items-center gap-2 text-sm font-medium leading-snug text-muted-foreground">
 <AlertTriangle className="h-4 w-4" />
 Blacklisted
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-xl font-bold text-destructive lg:text-2xl">{blacklistedCount}</div>
 </CardContent>
 </Card>
 </div>

 {/* Filters and Actions */}
 <Card className="border-emerald-100">
 <CardContent className="p-4">
 <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
 <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
 <div className="relative min-w-0 flex-1 sm:min-w-[200px] sm:max-w-sm">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search customers..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
 />
 </div>
 <Select value={typeFilter} onValueChange={setTypeFilter}>
 <SelectTrigger className="w-full min-[420px]:w-44 sm:w-36">
 <Filter className="mr-2 h-4 w-4" />
 <SelectValue placeholder="Type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Types</SelectItem>
 <SelectItem value="individual">Individual</SelectItem>
 <SelectItem value="business">Business</SelectItem>
 </SelectContent>
 </Select>
 <Select value={riskFilter} onValueChange={setRiskFilter}>
 <SelectTrigger className="w-full min-[420px]:w-44 sm:w-36">
 <SelectValue placeholder="Risk Grade" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Grades</SelectItem>
 <SelectItem value="A">Grade A</SelectItem>
 <SelectItem value="B">Grade B</SelectItem>
 <SelectItem value="C">Grade C</SelectItem>
 <SelectItem value="D">Grade D</SelectItem>
 </SelectContent>
 </Select>
 <Select value={loanStatusFilter} onValueChange={setLoanStatusFilter}>
 <SelectTrigger className="w-full min-[420px]:w-44 sm:w-44">
 <SelectValue placeholder="Loan status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Loan Statuses</SelectItem>
 <SelectItem value="due_soon">Payment due soon</SelectItem>
 <SelectItem value="overdue">Payment overdue</SelectItem>
 <SelectItem value="none">No active loans</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <Button asChild className="w-full shrink-0 md:w-auto">
 <Link href={`${customersBasePath}/new`}>
 <Plus className="mr-2 h-4 w-4" />
 New Customer
 </Link>
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* Customers Table */}
 <Card className="overflow-hidden border-emerald-100">
 <CardContent className="space-y-4 p-0">
 <div className="grid gap-3 p-4 sm:hidden">
 {filteredCustomers.length === 0 ? (
 <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
 {isOfficerView ? t("customers.noCustomersOfficer") : t("customers.noCustomers")}
 </p>
 ) : (
 filteredCustomers.map((customer) => {
 const risk = riskGradeConfig[customer.risk_grade];
 const loanStatus = activeLoansForCustomer(customer.id);
 const avatarSrc = resolveMediaViewUrl(
  customer.passport_photo_preview_url,
  customer.passport_photo_url
 );

 return (
 <div
 key={customer.id}
 className={`rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 ${statusClasses(loanStatus.tone)}`}
 >
 <div className="flex items-start gap-3">
 <Avatar className="h-14 w-14 shrink-0">
 {avatarSrc ? (
  <AvatarImage
   src={avatarSrc}
   alt={`${customer.first_name} ${customer.last_name}`}
   className="object-cover"
   loading="lazy"
  />
 ) : null}
 <AvatarFallback className="bg-primary/10 text-primary text-base">
 {customer.first_name[0]}
 {customer.last_name[0]}
 </AvatarFallback>
 </Avatar>
 <div className="min-w-0 flex-1">
 <p className="font-medium leading-snug">
 {customer.first_name} {customer.last_name}
 </p>
 <p className="font-mono text-xs text-muted-foreground">{customer.customer_number}</p>
 </div>
 <Badge variant={risk.variant} className="shrink-0 text-xs">
 {risk.label}
 </Badge>
 </div>

 <div className="mt-3 space-y-1.5 text-sm">
 <div className="flex items-start gap-1.5">
 <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
 <div className="min-w-0">
 {customerDisplayPhones(customer).map((phone, index) => (
 <span key={`${phone}-${index}`} className="block truncate">
 {phone}
 </span>
 ))}
 </div>
 </div>
 {customer.email ? (
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <Mail className="h-3.5 w-3.5 shrink-0" />
 <span className="truncate">{customer.email}</span>
 </div>
 ) : null}
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <MapPin className="h-3.5 w-3.5 shrink-0" />
 <span className="truncate">
 {customer.district}, {customer.region}
 </span>
 </div>
 </div>

 <div className="mt-3 flex flex-wrap items-center gap-2">
 <Badge variant="outline" className="capitalize">
 {customer.customer_type === "business" ? (
 <Building2 className="mr-1 h-3 w-3" />
 ) : (
 <User className="mr-1 h-3 w-3" />
 )}
 {customer.customer_type}
 </Badge>
 {customer.income_verified ? (
 <Badge variant="secondary" className="text-xs">
 Verified income
 </Badge>
 ) : null}
 </div>

 <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
 <div>
 <p className="text-xs text-muted-foreground">Monthly income</p>
 <p className="font-semibold">{formatCurrency(customer.monthly_income)}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Registered</p>
 <p className="font-medium">{formatDate(customer.created_at)}</p>
 </div>
 </div>

 <div className="mt-3">
 {loanStatus.count > 0 ? (
 <div className="space-y-1">
 <Badge variant="outline" className={statusBadgeClasses(loanStatus.tone)}>
 {loanStatus.label}
 </Badge>
 <p className="text-sm font-medium">
 {loanStatus.count} loan(s) · {formatCurrency(loanStatus.outstanding)} outstanding
 </p>
 {loanStatus.nextDueDate ? (
 <p className="text-xs text-muted-foreground">
 Due {formatDate(loanStatus.nextDueDate)}
 </p>
 ) : null}
 {loanStatus.penalty > 0 ? (
 <p className="text-xs font-medium text-red-600">
 Penalty {formatCurrency(loanStatus.penalty)}
 </p>
 ) : null}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">No active loans</p>
 )}
 </div>

 <div className="mt-3 flex gap-2">
 <Button size="sm" variant="outline" className="h-8 flex-1" asChild>
 <Link href={`${customersBasePath}/${customer.id}`}>
 <Eye className="mr-1 h-3.5 w-3.5" />
 View Details
 </Link>
 </Button>
 {isSuperAdmin ? (
 <Button
 size="sm"
 variant="outline"
 className="h-8 text-destructive hover:text-destructive"
 onClick={() => {
 setDeleteTarget(customer);
 setDeleteDialogOpen(true);
 }}
 aria-label={`Delete ${customer.first_name} ${customer.last_name}`}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 ) : null}
 </div>
 </div>
 );
 })
 )}
 </div>

 <div className="hidden sm:block">
 <div className="overflow-x-auto [touch-action:pan-x]">
 <Table className="min-w-[860px] lg:min-w-[980px]">
 <TableHeader>
 <TableRow className="bg-emerald-50/70 hover:bg-emerald-50/70">
 <TableHead>Customer</TableHead>
 <TableHead>Contact</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Location</TableHead>
 <TableHead className="text-right">Monthly Income</TableHead>
 <TableHead>Risk Grade</TableHead>
 <TableHead>Active Loans</TableHead>
 <TableHead>Registered</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredCustomers.length === 0 ? (
 <TableRow>
 <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
 {isOfficerView ? t("customers.noCustomersOfficer") : t("customers.noCustomers")}
 </TableCell>
 </TableRow>
 ) : (
 filteredCustomers.map((customer) => {
 const risk = riskGradeConfig[customer.risk_grade];
 const loanStatus = activeLoansForCustomer(customer.id);
 const avatarSrc = resolveMediaViewUrl(
  customer.passport_photo_preview_url,
  customer.passport_photo_url
 );

 return (
 <TableRow key={customer.id} className={statusClasses(loanStatus.tone)}>
 <TableCell>
 <div className="flex items-center gap-3">
 <Avatar className="h-12 w-12">
 {avatarSrc ? (
  <AvatarImage
   src={avatarSrc}
   alt={`${customer.first_name} ${customer.last_name}`}
   className="object-cover"
   loading="lazy"
  />
 ) : null}
 <AvatarFallback className="bg-primary/10 text-primary text-sm">
 {customer.first_name[0]}
 {customer.last_name[0]}
 </AvatarFallback>
 </Avatar>
 <div>
 <p className="font-medium">
 {customer.first_name} {customer.last_name}
 </p>
 <p className="text-sm text-muted-foreground">
 {customer.customer_number}
 </p>
 </div>
 </div>
 </TableCell>
 <TableCell>
 <div className="space-y-1">
 {customerDisplayPhones(customer).map((phone, index) => (
 <div key={`${phone}-${index}`} className="flex items-center gap-1 text-sm">
 {index === 0 ? <Phone className="h-3 w-3 text-muted-foreground" /> : <span className="w-3" />}
 {phone}
 </div>
 ))}
 {customer.email && (
 <div className="flex items-center gap-1 text-sm text-muted-foreground">
 <Mail className="h-3 w-3" />
 {customer.email}
 </div>
 )}
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="outline" className="capitalize">
 {customer.customer_type === "business" ? (
 <Building2 className="mr-1 h-3 w-3" />
 ) : (
 <User className="mr-1 h-3 w-3" />
 )}
 {customer.customer_type}
 </Badge>
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-1 text-sm">
 <MapPin className="h-3 w-3 text-muted-foreground" />
 {customer.district}, {customer.region}
 </div>
 </TableCell>
 <TableCell className="text-right">
 {formatCurrency(customer.monthly_income)}
 {customer.income_verified && (
 <Badge variant="secondary" className="ml-2 text-xs">
 Verified
 </Badge>
 )}
 </TableCell>
 <TableCell>
 <Badge variant={risk.variant}>{risk.label}</Badge>
 {customer.credit_score && (
 <span className="ml-2 text-xs text-muted-foreground">
 ({customer.credit_score})
 </span>
 )}
 </TableCell>
 <TableCell>
 {loanStatus.count > 0 ? (
 <div className="space-y-1">
 <Badge variant="outline" className={statusBadgeClasses(loanStatus.tone)}>
 {loanStatus.label}
 </Badge>
 <p className="font-medium">{loanStatus.count} loan(s)</p>
 <p className="text-xs text-muted-foreground">
 {formatCurrency(loanStatus.outstanding)} outstanding
 </p>
 {loanStatus.nextDueDate ? (
 <p className="text-xs text-muted-foreground">
 Due {formatDate(loanStatus.nextDueDate)}
 </p>
 ) : null}
 {loanStatus.penalty > 0 ? (
 <p className="text-xs font-medium text-red-600">
 Penalty {formatCurrency(loanStatus.penalty)}
 </p>
 ) : null}
 </div>
 ) : (
 <span className="text-muted-foreground">None</span>
 )}
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {formatDate(customer.created_at)}
 </TableCell>
 <TableCell className="text-right">
 <div className="flex items-center justify-end gap-1">
 <Button variant="ghost" size="sm" asChild>
 <Link href={`${customersBasePath}/${customer.id}`}>
 <Eye className="h-4 w-4" />
 <span className="sr-only">View</span>
 </Link>
 </Button>
 {isSuperAdmin ? (
 <Button
 variant="ghost"
 size="sm"
 className="text-destructive hover:text-destructive"
 onClick={() => {
 setDeleteTarget(customer);
 setDeleteDialogOpen(true);
 }}
 aria-label={`Delete ${customer.first_name} ${customer.last_name}`}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 ) : null}
 </div>
 </TableCell>
 </TableRow>
 );
 })
 )}
 </TableBody>
 </Table>
 </div>
 </div>
 </CardContent>
 </Card>
 </>
 )}

 {isSuperAdmin ? (
 <DeleteCustomerDialog
 customer={deleteTarget}
 open={deleteDialogOpen}
 onOpenChange={(open) => {
 setDeleteDialogOpen(open);
 if (!open) setDeleteTarget(null);
 }}
 onDeleted={(opts) => {
  if (!deleteTarget?.id) {
   void loadCustomers();
   return;
  }
  const id = deleteTarget.id;
  setHiddenCustomerIds((prev) => {
   const next = new Set(prev);
   next.add(id);
   addHiddenCustomerId(id);
   return next;
  });
 if (opts?.softOnly) {
 setSoftDeleteNotice(
 opts.backendMessage
 ? `Customer hidden from this UI list only. Backend message: ${opts.backendMessage}`
 : "Customer hidden from this UI list only."
 );
 } else if (opts?.deactivated) {
 setSoftDeleteNotice("Customer deactivated.");
 } else {
 setSoftDeleteNotice(null);
 }
 void loadCustomers();
 }}
 />
 ) : null}
 </div>
 </main>
 </>
 );
}
