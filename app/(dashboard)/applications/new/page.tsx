"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
 ArrowLeft,
 Search,
 Upload,
 Send,
} from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
 Field,
 FieldGroup,
 FieldLabel,
} from "@/components/ui/field";
import {
 adaptApiCustomerRowToCustomer,
 extractCustomerDetail,
 extractCustomersList,
} from "@/lib/customer-adapters";
import { extractGroupsList } from "@/lib/group-adapters";
import { formatCurrency } from "@/lib/formatters";
import { calculateLoanFormula, monthsFromTermDays } from "@/lib/loan-formula";
import { extractProductsList } from "@/lib/product-adapters";
import {
  customerGuarantorsToApplicationPayload,
  parseCustomerGuarantorsFromRow,
  type CustomerGuarantorRecord,
} from "@/lib/customer-guarantors";
import {
  customerReferencesToApplicationPayload,
  parseCustomerReferencesFromRow,
  type CustomerReferenceRecord,
} from "@/lib/customer-references";
import { parseCustomerCollateralFromRow, type CustomerCollateralApiRecord } from "@/lib/customer-collateral";
import {
  clearCustomerGuarantorPendingFiles,
  getCustomerGuarantorPendingFiles,
} from "@/lib/customer-guarantor-pending-files";
import type { Customer, LoanGroup, LoanMode, LoanProduct, RepaymentFrequency } from "@/lib/types";
import { extractApplicationDetail } from "@/lib/application-adapters";
import {
 APPLICATION_REPAYMENT_FREQUENCIES,
 mapApplicationFormToFalcoBody,
 normalizeApplicationRepaymentFrequency,
 validateApplicationAgainstProduct,
} from "@/lib/application-payload";
import { RequiredDocumentsFields } from "@/components/applications/required-documents-fields";
import { ApplicationCustomerLocationSection } from "@/components/applications/application-customer-location-section";
import {
 formatRequiredDocumentLabel,
 normalizeDocumentType,
} from "@/lib/application-documents";
import {
 assignApplicationOfficerApi,
 extractApplicationIdFromResponse,
 formatClientApiError,
 runPostCreateWorkflow,
 uploadApplicationDocumentsFromForm,
} from "@/lib/application-workflow";
import {
 extractLinkedApplicationIds,
 fetchLinkedApplicationIds,
 linkedIdsNeedRefresh,
 uploadCollateralAndGuarantorFiles,
 type GuarantorFileRow,
} from "@/lib/application-linked-uploads";
import { APPLICATION_DOCUMENTS_OPTIONAL } from "@/lib/application-workflow-config";
import {
  debugApplicationCreate,
  summarizeApplicationBody,
} from "@/lib/application-debug";
import { useSessionUser } from "@/lib/use-session-user";
import { MoneyInput } from "@/components/forms/money-input";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import { formatMoneyFromNumber, parseMoneyInput } from "@/lib/money-input";

function parseAmountInput(raw: string): number {
 const n = parseMoneyInput(raw);
 return n > 0 ? n : 0;
}

function parseTermInput(raw: string): number {
 const cleaned = String(raw ?? "")
 .replace(/,/g, "")
 .replace(/\s/g, "")
 .replace(/_/g, "");
 const n = parseInt(cleaned, 10);
 return Number.isFinite(n) && n > 0 ? n : 0;
}

function NewApplicationPageFallback() {
 return (
 <>
 <DashboardHeader title="New Loan Application" description="Loading…" />
 <main className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
 <div className="rounded-lg border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
 Loading application form…
 </div>
 </main>
 </>
 );
}

function NewApplicationPageContent() {
 const router = useRouter();
 const pathname = usePathname();
 const searchParams = useSearchParams();
 const editId = searchParams.get("edit")?.trim() || null;
 const { user } = useSessionUser();
 const effectiveRole = user?.role ?? "super_admin";
 const isAdminView = effectiveRole === "super_admin";
 const isScopedRole = effectiveRole === "branch_manager" || effectiveRole === "loan_officer";
 const scopeBranchId = isScopedRole ? user?.branch_id : null;
 const applicationsBasePath =
 effectiveRole === "branch_manager"
 ? "/manager/applications"
 : effectiveRole === "loan_officer"
 ? "/officer/applications"
 : "/applications";
 const groupsBasePath =
 effectiveRole === "branch_manager"
 ? "/manager/groups"
 : effectiveRole === "loan_officer"
 ? "/officer/groups"
 : "/groups";
 const loanCalculatorPath =
 effectiveRole === "loan_officer"
 ? "/officer/loan-calculator"
 : effectiveRole === "branch_manager"
 ? "/manager/loan-calculator"
 : "/loan-calculator";
 const creditAnalysisPath =
 effectiveRole === "loan_officer" ? "/officer/credit-analysis" : "/credit-analysis";
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [groups, setGroups] = useState<LoanGroup[]>([]);
 const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
 const [productsLoading, setProductsLoading] = useState(false);
 const [productsError, setProductsError] = useState("");

 const loadLoanProducts = useCallback(async () => {
 setProductsLoading(true);
 setProductsError("");
 try {
 const r = await fetch("/api/falco/products?is_active=true", { credentials: "include" });
 const json = (await r.json()) as { message?: string; error?: string; products?: LoanProduct[] };
 if (!r.ok) {
 setProductsError(json.message ?? json.error ?? `Could not load products (${r.status})`);
 setLoanProducts([]);
 return;
 }
 const list = extractProductsList(json);
 setLoanProducts(list);
 if (!list.length) {
 setProductsError("No active loan products found. Create products under Loan Products first.");
 }
 } catch {
 setProductsError("Could not load loan products from the server.");
 setLoanProducts([]);
 } finally {
 setProductsLoading(false);
 }
 }, []);

 useEffect(() => {
 let cancelled = false;
 setProductsLoading(true);
 setProductsError("");

 const listParams = new URLSearchParams();
 listParams.set("page_size", "80");
 if (scopeBranchId) listParams.set("branch_id", scopeBranchId);

 const groupParams = new URLSearchParams({ page_size: "80", status: "active" });
 if (scopeBranchId) groupParams.set("branch_id", scopeBranchId);

 void Promise.all([
 fetch("/api/falco/products?is_active=true", { credentials: "include" }),
 fetch(`/api/customers?${listParams.toString()}`, { credentials: "include" }),
 fetch(`/api/groups?${groupParams.toString()}`, { credentials: "include" }),
 ])
 .then(async ([productsRes, customersRes, groupsRes]) => {
 if (cancelled) return;
 const [productsJson, customersJson, groupsJson] = await Promise.all([
 productsRes.json(),
 customersRes.json(),
 groupsRes.json(),
 ]);
 if (!productsRes.ok) {
 const j = productsJson as { message?: string; error?: string };
 setProductsError(j.message ?? j.error ?? `Could not load products (${productsRes.status})`);
 setLoanProducts([]);
 } else {
 const list = extractProductsList(productsJson);
 setLoanProducts(list);
 if (!list.length) {
 setProductsError("No active loan products found. Create products under Loan Products first.");
 }
 }
 if (customersRes.ok) setCustomers(extractCustomersList(customersJson));
 if (groupsRes.ok) setGroups(extractGroupsList(groupsJson));
 })
 .catch(() => {
 if (!cancelled) setProductsError("Could not load form data from the server.");
 })
 .finally(() => {
 if (!cancelled) setProductsLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, [scopeBranchId]);

 const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
 const [selectedGroup, setSelectedGroup] = useState<LoanGroup | null>(null);
 const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
 const [loanMode, setLoanMode] = useState<LoanMode>("individual");
 const [customerSearch, setCustomerSearch] = useState("");
 const [groupSelectLoading, setGroupSelectLoading] = useState(false);
 const [groupSelectError, setGroupSelectError] = useState("");
 const [editLoading, setEditLoading] = useState(Boolean(editId));
 const [editingApplicationId, setEditingApplicationId] = useState<string | null>(editId);

 const [customerGuarantorRecords, setCustomerGuarantorRecords] = useState<CustomerGuarantorRecord[]>(
  []
 );
 const [customerReferenceRecords, setCustomerReferenceRecords] = useState<CustomerReferenceRecord[]>(
  []
 );
 const [customerCollateralRecords, setCustomerCollateralRecords] = useState<CustomerCollateralApiRecord[]>(
  []
 );
 const [guarantorFileRows, setGuarantorFileRows] = useState<GuarantorFileRow[]>([]);

 const [documentFiles, setDocumentFiles] = useState<Record<string, File[]>>({});
 const [isSaving, setIsSaving] = useState(false);

 const [formData, setFormData] = useState({
 amount: "",
 term: "",
 purpose: "",
 repaymentFrequency: "weekly" as RepaymentFrequency,
 latitude: "",
 longitude: "",
 locationLabel: "",
 });

 const [editAppDetail, setEditAppDetail] = useState<Record<string, unknown> | null>(null);

 const loadCustomerGuarantors = useCallback(async (customerId: string) => {
  try {
   const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
    credentials: "include",
    cache: "no-store",
   });
   const json = (await res.json()) as unknown;
   const row = extractCustomerDetail(json);
   const records = parseCustomerGuarantorsFromRow(row);
   const referenceRecords = parseCustomerReferencesFromRow(row);
   const collateralRecords = parseCustomerCollateralFromRow(row);
   const pending = getCustomerGuarantorPendingFiles(customerId);
   const fileRows = records.map((record, index) => ({
    name: record.full_name,
    phone: record.phone,
    idFront: pending?.[index]?.idFront ?? null,
    idBack: pending?.[index]?.idBack ?? null,
    photo: pending?.[index]?.photo ?? null,
    photoWithCustomer: pending?.[index]?.photoWithCustomer ?? null,
    wardLetter: pending?.[index]?.wardLetter ?? null,
    attachments: pending?.[index]?.attachments ?? [],
   }));
   setCustomerGuarantorRecords(records);
   setCustomerReferenceRecords(referenceRecords);
   setCustomerCollateralRecords(collateralRecords);
   setGuarantorFileRows(fileRows);
  } catch {
   setCustomerGuarantorRecords([]);
   setCustomerReferenceRecords([]);
   setCustomerCollateralRecords([]);
   setGuarantorFileRows([]);
  }
 }, []);

 useEffect(() => {
  if (!selectedCustomer?.id || editingApplicationId) {
   if (!selectedCustomer) {
    setCustomerGuarantorRecords([]);
    setCustomerReferenceRecords([]);
    setCustomerCollateralRecords([]);
    setGuarantorFileRows([]);
   }
   return;
  }
  void loadCustomerGuarantors(selectedCustomer.id);
 }, [selectedCustomer?.id, editingApplicationId, loadCustomerGuarantors, selectedCustomer]);

 useEffect(() => {
  if (editingApplicationId) return;
  setFormData((prev) => ({
   ...prev,
   latitude: "",
   longitude: "",
   locationLabel: "",
  }));
 }, [selectedCustomer?.id, editingApplicationId]);

 useEffect(() => {
 if (!editId) {
 setEditAppDetail(null);
 return;
 }
 let cancelled = false;
 setEditLoading(true);
 void fetch(`/api/applications/${encodeURIComponent(editId)}`, { credentials: "include" })
 .then((r) => r.json())
 .then((json) => {
 if (cancelled) return;
 const app = extractApplicationDetail(json);
 if (!app) return;
 setEditAppDetail(app);
 setEditingApplicationId(editId);
 })
 .finally(() => {
 if (!cancelled) setEditLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, [editId]);

 useEffect(() => {
 if (!editAppDetail) return;
 const app = editAppDetail;
 const customerId = String(app.customer_id ?? "");
 const productId = String(app.product_id ?? "");
 const cust = customers.find((c) => c.id === customerId);
 const prod = loanProducts.find((p) => p.id === productId);
 if (cust) setSelectedCustomer(cust);
 if (prod) setSelectedProduct(prod);
 if (app.loan_mode === "group_based" || app.loan_mode === "individual") {
 setLoanMode(app.loan_mode as LoanMode);
 }
 if (app.loan_mode === "group_based" && app.group_id) {
 const grp = groups.find((g) => g.id === String(app.group_id));
 if (grp) setSelectedGroup(grp);
 }
 const loc =
  app.location && typeof app.location === "object"
   ? (app.location as Record<string, unknown>)
   : null;
 const editLatitude = loc?.latitude != null ? String(loc.latitude) : "";
 const editLongitude = loc?.longitude != null ? String(loc.longitude) : "";
 setFormData((prev) => ({
 ...prev,
 amount: app.requested_amount
 ? formatMoneyFromNumber(Number(app.requested_amount))
 : "",
 term: String(app.term_days ?? ""),
 purpose: String(app.purpose ?? ""),
 repaymentFrequency: normalizeApplicationRepaymentFrequency(
  app.repayment_frequency,
  "weekly"
 ),
 latitude: editLatitude,
 longitude: editLongitude,
 locationLabel:
  editLatitude && editLongitude ? "Saved on this application" : "",
 }));
 }, [editAppDetail, customers, loanProducts, groups]);

 const resolveChairpersonCustomer = useCallback(
 async (group: LoanGroup): Promise<Customer | null> => {
 const existing = customers.find((c) => c.id === group.chairperson_customer_id);
 if (existing) return existing;
 try {
 const res = await fetch(
 `/api/customers/${encodeURIComponent(group.chairperson_customer_id)}`,
 { credentials: "include" }
 );
 const json = (await res.json()) as unknown;
 const row = extractCustomerDetail(json);
 if (!row) return null;
 return adaptApiCustomerRowToCustomer(row);
 } catch {
 return null;
 }
 },
 [customers]
 );

 const handleSelectGroup = useCallback(
 async (group: LoanGroup) => {
 setGroupSelectError("");
 setGroupSelectLoading(true);
 try {
 const chairperson = await resolveChairpersonCustomer(group);
 if (!chairperson) {
 setGroupSelectError(
 "Could not load the group chairperson customer. Add or activate the chairperson under Customers first."
 );
 return;
 }
 if (!chairperson.is_active || chairperson.is_blacklisted) {
 setGroupSelectError("The group chairperson is inactive or blacklisted and cannot be used for a loan.");
 return;
 }
 setSelectedGroup(group);
 setSelectedCustomer(chairperson);
 setFormData((prev) => ({
 ...prev,
 latitude:
 group.meeting_latitude != null && Number.isFinite(group.meeting_latitude)
 ? group.meeting_latitude.toFixed(6)
 : "",
 longitude:
 group.meeting_longitude != null && Number.isFinite(group.meeting_longitude)
 ? group.meeting_longitude.toFixed(6)
 : "",
 locationLabel: group.meeting_location
 ? `Group meeting location: ${group.meeting_location}`
 : group.village_or_street
 ? `Group meeting location: ${group.village_or_street}`
 : "",
 }));
 setCustomerSearch("");
 } finally {
 setGroupSelectLoading(false);
 }
 },
 [resolveChairpersonCustomer]
 );

 const visibleCustomers = scopeBranchId
 ? customers.filter((customer) => customer.branch_id === scopeBranchId)
 : customers;

 const visibleGroups = useMemo(() => {
 let list = groups.filter((g) => g.status === "active" && g.chairperson_customer_id);
 if (scopeBranchId) {
 list = list.filter((g) => g.branch_id === scopeBranchId);
 }
 if (scopeBranchId && user?.role === "loan_officer") {
 list = list.filter((g) => g.loan_officer_id === user.id);
 }
 return list;
 }, [groups, scopeBranchId, user]);

 const filteredCustomers = visibleCustomers.filter(
 (c) =>
 c.is_active &&
 !c.is_blacklisted &&
 (c.first_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
 c.last_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
 c.customer_number.toLowerCase().includes(customerSearch.toLowerCase()))
 );

 const filteredGroups = visibleGroups.filter((g) => {
 const q = customerSearch.toLowerCase();
 return (
 g.group_name.toLowerCase().includes(q) ||
 g.group_code.toLowerCase().includes(q) ||
 g.village_or_street.toLowerCase().includes(q)
 );
 });

 const isGroupMode = loanMode === "group_based";
 const hasBorrower = isGroupMode ? Boolean(selectedGroup && selectedCustomer) : Boolean(selectedCustomer);

 const activeLoanProducts = useMemo(
 () => loanProducts.filter((p) => p.is_active !== false),
 [loanProducts]
 );

 const eligibleProductsStrict = useMemo(() => {
 if (!selectedCustomer) return [];
 return activeLoanProducts.filter((p) => {
 if (!p.is_active) return false;
 if (!p.allowed_risk_grades.includes(selectedCustomer.risk_grade)) return false;
 if (
 p.min_credit_score != null &&
 selectedCustomer.credit_score != null &&
 selectedCustomer.credit_score < p.min_credit_score
 ) {
 return false;
 }
 return true;
 });
 }, [activeLoanProducts, selectedCustomer]);

 /** If strict rules yield no row (API shape / missing score), still allow choosing an active product. */
 const eligibleProducts = useMemo(() => {
 if (!selectedCustomer) return [];
 if (eligibleProductsStrict.length > 0) return eligibleProductsStrict;
 return activeLoanProducts;
 }, [eligibleProductsStrict, activeLoanProducts, selectedCustomer]);

 useEffect(() => {
 if (!selectedProduct) return;
 if (!eligibleProducts.some((p) => p.id === selectedProduct.id)) {
 setSelectedProduct(null);
 }
 }, [eligibleProducts, selectedProduct]);

 useEffect(() => {
 if (!selectedProduct) {
 setDocumentFiles({});
 return;
 }
 setDocumentFiles((prev) => {
 const next: Record<string, File[]> = {};
 for (const raw of selectedProduct.required_documents) {
 const type = normalizeDocumentType(raw);
 next[type] = prev[type] ?? [];
 }
 return next;
 });
 }, [selectedProduct?.id]);

 // Calculate loan details
 const amount = parseAmountInput(formData.amount);
 const termDays = parseTermInput(formData.term);

 const calculateLoanDetails = () => {
 if (!selectedProduct || !amount || !termDays) return null;

 const formula = calculateLoanFormula({
 principal: amount,
 months: monthsFromTermDays(termDays),
 interestRatePerMonth:
 selectedProduct.interest_rate_per_month ?? selectedProduct.interest_rate / 12,
 processingFeePercent: selectedProduct.processing_fee_percent,
 insuranceFeePercent: selectedProduct.insurance_fee_percent,
 repaymentFrequency: normalizeApplicationRepaymentFrequency(
  formData.repaymentFrequency,
  selectedProduct.repayment_frequency
 ),
 interestType: selectedProduct.interest_type,
 });

 return {
 processingFee: formula.processingFee,
 insuranceFee: formula.insuranceFee,
 totalFees: formula.totalFees,
 interest: formula.interestAmount,
 totalRepayment: formula.totalRepayment,
 installmentCount: formula.repaymentCount,
 installmentAmount: formula.installmentAmount,
 };
 };

 const loanDetails = calculateLoanDetails();
 const combinedIncome = selectedCustomer
 ? selectedCustomer.monthly_income + (selectedCustomer.other_income || 0)
 : 0;
 const analysis = useMemo(() => {
 if (!selectedCustomer || !selectedProduct) return null;

 const blockers: string[] = [];
 const cautions: string[] = [];
 const strengths: string[] = [];

 if (amount <= 0) {
 cautions.push("Enter a requested amount to generate recommendation.");
 }
 if (!termDays) {
 cautions.push("Enter a loan term to generate recommendation.");
 }

 if (amount && (amount < selectedProduct.min_amount || amount > selectedProduct.max_amount)) {
 blockers.push(
 `Requested amount must be between ${formatCurrency(selectedProduct.min_amount)} and ${formatCurrency(selectedProduct.max_amount)}.`
 );
 } else if (amount) {
 strengths.push("Requested amount is within product policy.");
 }

 if (
 termDays &&
 (termDays < selectedProduct.min_term_days || termDays > selectedProduct.max_term_days)
 ) {
 blockers.push(
 `Requested term must be between ${selectedProduct.min_term_days} and ${selectedProduct.max_term_days} days.`
 );
 } else if (termDays) {
 strengths.push("Requested term is within product policy.");
 }

 if (!selectedProduct.allowed_risk_grades.includes(selectedCustomer.risk_grade)) {
 blockers.push(`Risk grade ${selectedCustomer.risk_grade} is not allowed for this product.`);
 } else {
 strengths.push(`Risk grade ${selectedCustomer.risk_grade} is eligible for this product.`);
 }

 const minScore = selectedProduct.min_credit_score ?? 0;
 if (selectedProduct.min_credit_score) {
 if (!selectedCustomer.credit_score) {
 cautions.push(`Credit score is required (minimum ${selectedProduct.min_credit_score}).`);
 } else if (selectedCustomer.credit_score < selectedProduct.min_credit_score) {
 blockers.push(
 `Credit score ${selectedCustomer.credit_score} is below required ${selectedProduct.min_credit_score}.`
 );
 } else {
 strengths.push(`Credit score ${selectedCustomer.credit_score} meets the minimum ${selectedProduct.min_credit_score}.`);
 }
 } else if (selectedCustomer.credit_score) {
 strengths.push(`Credit score ${selectedCustomer.credit_score} recorded.`);
 }

 if (!selectedCustomer.income_verified) {
 cautions.push("Income is not verified.");
 } else {
 strengths.push("Income is verified.");
 }

 const installment = loanDetails?.installmentAmount ?? 0;
 const ratio = combinedIncome > 0 && installment > 0 ? installment / combinedIncome : null;
 if (ratio !== null) {
 if (ratio > 0.6) {
 blockers.push("Estimated installment exceeds 60% of monthly income.");
 } else if (ratio > 0.4) {
 cautions.push("Estimated installment is above 40% of monthly income.");
 } else {
 strengths.push("Estimated installment appears affordable against monthly income.");
 }
 }

 let decision: "approve" | "review" | "decline" = "approve";
 if (blockers.length > 0) {
 decision = "decline";
 } else if (cautions.length > 0) {
 decision = "review";
 }

 return {
 decision,
 blockers,
 cautions,
 strengths,
 minScore,
 installment,
 ratio,
 };
 }, [selectedCustomer, selectedProduct, amount, termDays, loanDetails, combinedIncome]);

 const handleSubmit = async (isDraft: boolean) => {
 debugApplicationCreate("handleSubmit — start", {
  isDraft,
  editId: editingApplicationId,
  customer_id: selectedCustomer?.id,
  product_id: selectedProduct?.id,
  role: effectiveRole,
 });
 if (isSaving) return;
 if (!hasBorrower || !selectedCustomer || !selectedProduct) return;
 if (isGroupMode && !selectedGroup) {
 alert("Select a vikundi group before submitting.");
 return;
 }

 const termParsed = parseTermInput(formData.term);
 const amountParsed = parseAmountInput(formData.amount);
 const termDays =
 termParsed > 0 ? termParsed : isDraft ? Math.max(1, selectedProduct.min_term_days) : 0;
 const amount =
 amountParsed > 0 ? amountParsed : isDraft ? Math.max(1, selectedProduct.min_amount) : 0;

 if (!isDraft && (termDays <= 0 || amount <= 0)) {
 alert("Enter a valid requested amount and term (in days) before submitting.");
 return;
 }

 if (isDraft && (termDays <= 0 || amount <= 0)) {
 alert("Unable to save draft: invalid amount or term.");
 return;
 }

 const guarantorsPayload = customerGuarantorsToApplicationPayload(customerGuarantorRecords);

 const referencesPayload = customerReferencesToApplicationPayload(customerReferenceRecords);

 const collateralsPayload = customerCollateralRecords
  .filter((c) => c.collateral_type?.trim())
  .map((c) => ({
   type: c.collateral_type,
   description: c.description ?? "",
   estimated_value: c.estimated_value ?? 0,
  }));

 const location =
 formData.latitude && formData.longitude
 ? {
 latitude: formData.latitude,
 longitude: formData.longitude,
 captured_at: new Date().toISOString(),
 }
 : undefined;

 const productError = validateApplicationAgainstProduct(amount, termDays, selectedProduct);
 if (productError) {
 alert(productError);
 return;
 }

 const body = mapApplicationFormToFalcoBody({
 customer_id: selectedCustomer.id,
 product_id: selectedProduct.id,
 loan_mode: loanMode,
 group_id: isGroupMode ? selectedGroup!.id : null,
 requested_amount: amount,
 term_days: termDays,
 purpose: formData.purpose.trim() || "Working capital",
 repayment_frequency: normalizeApplicationRepaymentFrequency(
  formData.repaymentFrequency,
  selectedProduct.repayment_frequency
 ),
 collaterals: collateralsPayload,
 guarantors: guarantorsPayload,
 references: referencesPayload,
 location,
 });

 debugApplicationCreate("handleSubmit — payload ready", summarizeApplicationBody(body));

 setIsSaving(true);
 try {
 const isEdit = Boolean(editingApplicationId);
 debugApplicationCreate(isEdit ? "PATCH /api/applications/:id — sending" : "POST /api/applications — sending");
 const res = isEdit
 ? await fetch(`/api/applications/${encodeURIComponent(editingApplicationId!)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 })
 : await fetch("/api/applications", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });

 const data = await res.json().catch(() => ({}));
 debugApplicationCreate("handleSubmit — API response", {
  ok: res.ok,
  status: res.status,
  response_keys: data && typeof data === "object" ? Object.keys(data as object) : [],
 });
 if (!res.ok) {
 debugApplicationCreate("handleSubmit — save failed", data);
 alert(formatClientApiError(data, `Save failed (${res.status})`));
 return;
 }

 const applicationId =
 editingApplicationId ?? extractApplicationIdFromResponse(data) ?? null;
 debugApplicationCreate("handleSubmit — application id", { applicationId });
 if (!applicationId) {
 debugApplicationCreate("handleSubmit — missing application id in response", data);
 alert("Application saved but id was not returned.");
 router.push(applicationsBasePath);
 return;
 }

 const isNewApplication = !editingApplicationId;
 if (isNewApplication) {
 setEditingApplicationId(applicationId);
 }

 const officerId =
 selectedCustomer.assigned_loan_officer_id ||
 (effectiveRole === "loan_officer" && user?.id ? user.id : undefined);

 const hasLinkedFiles =
  guarantorFileRows.some(
   (g) =>
    g.idFront ||
    g.idBack ||
    g.photo ||
    g.photoWithCustomer ||
    g.wardLetter ||
    g.attachments.length > 0
 );

 let linkedIds = extractLinkedApplicationIds(data);
 if (!linkedIds || (hasLinkedFiles && linkedIdsNeedRefresh(linkedIds, [], guarantorFileRows))) {
  linkedIds = (await fetchLinkedApplicationIds(applicationId)) ?? linkedIds;
 }
 debugApplicationCreate("handleSubmit — linked IDs", linkedIds);

 if (hasLinkedFiles && !linkedIds) {
  alert(
   "Application saved but collateral/guarantor IDs were not returned. Refresh and try uploading files again."
  );
  return;
 }

 const assignPromise = officerId
  ? assignApplicationOfficerApi(applicationId, { assigned_officer_id: officerId })
  : Promise.resolve({ ok: true as const });

 const linkedUploadPromise =
  linkedIds && hasLinkedFiles
   ? uploadCollateralAndGuarantorFiles(applicationId, linkedIds, [], guarantorFileRows)
   : Promise.resolve({ ok: true as const });

 const [assign, linkedUpload] = await Promise.all([assignPromise, linkedUploadPromise]);

 if (!assign.ok) {
  console.warn("Officer assign:", assign.error);
 }
 debugApplicationCreate("handleSubmit — collateral/guarantor upload result", {
  ok: linkedUpload.ok,
  error: linkedUpload.ok ? undefined : linkedUpload.error,
 });
 if (!linkedUpload.ok) {
  alert(`File upload failed: ${linkedUpload.error}`);
  return;
 }

 if (selectedCustomer?.id) {
  clearCustomerGuarantorPendingFiles(selectedCustomer.id);
 }

 if (!isDraft) {
 const required = selectedProduct.required_documents ?? [];
 debugApplicationCreate("handleSubmit — uploading documents", {
  applicationId,
  required_count: required.length,
  file_types: Object.keys(documentFiles).filter((k) => documentFiles[k]?.length),
 });

 const docUpload = await uploadApplicationDocumentsFromForm(
 applicationId,
 documentFiles,
 required
 );
 debugApplicationCreate("handleSubmit — document upload result", {
  ok: docUpload.ok,
  error: docUpload.ok ? undefined : docUpload.error,
 });
 if (!docUpload.ok) {
 console.warn("Document upload:", docUpload.error);
 if (!APPLICATION_DOCUMENTS_OPTIONAL) {
 alert(`Document upload failed: ${docUpload.error}`);
 return;
 }
 }

 debugApplicationCreate("handleSubmit — running post-create workflow", { applicationId, role: effectiveRole });
 const workflow = await runPostCreateWorkflow({
 applicationId,
 isDraft: false,
 role: effectiveRole,
 approvedAmount: amount,
 actorName: user?.full_name ?? "User",
 documentFiles: {},
 requiredDocuments: required,
 });
 debugApplicationCreate("handleSubmit — workflow result", {
  ok: workflow.ok,
  error: workflow.ok ? undefined : workflow.error,
 });
 if (!workflow.ok) {
 alert(workflow.error);
 router.push(`${applicationsBasePath}?highlight=${applicationId}`);
 return;
 }

 if (effectiveRole === "super_admin") {
 router.push("/disbursements?activated=1");
 } else {
 const loansPath =
 effectiveRole === "branch_manager" ? "/manager/loans" : "/officer/loans";
 router.push(`${loansPath}?status=pending_disbursement&activated=1`);
 }
 return;
 }

 debugApplicationCreate("handleSubmit — draft saved", { applicationId });
 if (isNewApplication) {
 const next = new URLSearchParams(searchParams.toString());
 next.set("edit", applicationId);
 router.replace(`${pathname}?${next.toString()}`, { scroll: false });
 }
 router.push(`${applicationsBasePath}?highlight=${applicationId}`);
 } catch (err) {
 debugApplicationCreate("handleSubmit — network error", err);
 alert("Unable to reach server.");
 } finally {
 setIsSaving(false);
 }
 };

 return (
 <>
 <DashboardHeader
 title={editingApplicationId ? "Continue loan application" : "New Loan Application"}
 description={
 editingApplicationId
 ? isAdminView
 ? "Complete required fields, then activate to create the loan for disbursement"
 : "Complete required fields and submit when ready"
 : "Create a new loan application for a customer"
 }
 />
 <main className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
 <div className="w-full space-y-4">
 <Button variant="ghost" size="sm" asChild>
 <Link href={applicationsBasePath}>
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Applications
 </Link>
 </Button>

 {editLoading ? (
 <div className="rounded-lg border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
 Loading draft application…
 </div>
 ) : null}

 <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
 {/* Main Form */}
 <div className="min-w-0 space-y-4">
 {/* Customer / Group Selection */}
 <Card>
 <CardHeader>
 <CardTitle>{isGroupMode ? "Group (Vikundi)" : "Customer Information"}</CardTitle>
 <CardDescription>
 {isGroupMode
 ? "Search and select a vikundi created under Vikundi / Groups. The chairperson is used as the borrower anchor."
 : "Search and select an existing customer"}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
{!editId || loanMode === "individual" ? (
<>
<p className="rounded-md border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm text-muted-foreground">
Vikundi member loans are started from each member row under{" "}
<Link href={groupsBasePath} className="font-medium text-foreground underline-offset-2 hover:underline">
Vikundi / Groups
</Link>
{" "}
(separate application and amount per member). This form is for individual customers.
</p>
</>
) : (
<Field>
<FieldLabel>Application Type</FieldLabel>
<p className="text-sm text-muted-foreground">
Legacy group-level draft. Prefer creating new member loans from Vikundi member rows.
</p>
</Field>
)}
 {groupSelectError ? (
 <p className="text-sm text-destructive">{groupSelectError}</p>
 ) : null}
 {isGroupMode ? (
 !selectedGroup ? (
 <>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search by group name, code, or village..."
 value={customerSearch}
 onChange={(e) => setCustomerSearch(e.target.value)}
 className="pl-9"
 disabled={groupSelectLoading}
 />
 </div>
 {(customerSearch || visibleGroups.length > 0) && (
 <div className="max-h-48 space-y-2 overflow-auto">
 {(customerSearch ? filteredGroups : visibleGroups).map((group) => (
 <button
 key={group.id}
 type="button"
 disabled={groupSelectLoading}
 onClick={() => void handleSelectGroup(group)}
 className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
 >
 <div>
 <p className="font-medium">{group.group_name}</p>
 <p className="text-sm text-muted-foreground">
 {group.group_code || "—"} | {group.member_customer_ids.length} members
 </p>
 <p className="text-xs text-muted-foreground">{group.village_or_street}</p>
 </div>
 <Badge variant="secondary">Active</Badge>
 </button>
 ))}
 {(customerSearch ? filteredGroups : visibleGroups).length === 0 ? (
 <p className="py-4 text-center text-muted-foreground">
 {customerSearch
 ? "No vikundi match your search. "
 : "No active vikundi in your branch. "}
 <Link href="/groups/new" className="text-primary underline">
 Create a group
 </Link>
 </p>
 ) : null}
 </div>
 )}
 </>
 ) : (
 <div className="flex items-start justify-between rounded-lg border border-border bg-muted/50 p-4">
 <div className="space-y-1">
 <p className="font-medium">{selectedGroup.group_name}</p>
 <p className="text-sm text-muted-foreground">
 {selectedGroup.group_code} | {selectedGroup.member_customer_ids.length} members
 </p>
 <p className="text-sm text-muted-foreground">{selectedGroup.meeting_location}</p>
 {selectedCustomer ? (
 <p className="text-xs text-muted-foreground pt-1">
 Chairperson: {selectedCustomer.first_name} {selectedCustomer.last_name} (
 {selectedCustomer.customer_number})
 </p>
 ) : null}
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 setSelectedGroup(null);
 setSelectedCustomer(null);
 setGroupSelectError("");
 }}
 >
 Change
 </Button>
 </div>
 )
 ) : !selectedCustomer ? (
 <>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search by name or customer number..."
 value={customerSearch}
 onChange={(e) => setCustomerSearch(e.target.value)}
 className="pl-9"
 />
 </div>
 {customerSearch && (
 <div className="max-h-48 space-y-2 overflow-auto">
 {filteredCustomers.map((customer) => (
 <button
 key={customer.id}
 type="button"
 onClick={() => {
 setSelectedCustomer(customer);
 setCustomerSearch("");
 }}
 className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
 >
 <div>
 <p className="font-medium">
 {customer.first_name} {customer.last_name}
 </p>
 <p className="text-sm text-muted-foreground">
 {customer.customer_number} | {customer.phone_primary}
 </p>
 </div>
 <Badge
 variant={
 customer.risk_grade === "A"
 ? "default"
 : customer.risk_grade === "B"
 ? "secondary"
 : "outline"
 }
 >
 Grade {customer.risk_grade}
 </Badge>
 </button>
 ))}
 {filteredCustomers.length === 0 && (
 <p className="py-4 text-center text-muted-foreground">
 No customers found
 </p>
 )}
 </div>
 )}
 </>
 ) : (
 <div className="flex items-start justify-between rounded-lg border border-border bg-muted/50 p-4">
 <div className="space-y-1">
 <p className="font-medium">
 {selectedCustomer.first_name} {selectedCustomer.last_name}
 </p>
 <p className="text-sm text-muted-foreground">
 {selectedCustomer.customer_number}
 </p>
 <p className="text-sm text-muted-foreground">
 {selectedCustomer.phone_primary}
 </p>
 <div className="flex gap-2 pt-1">
 <Badge variant="secondary">
 {selectedCustomer.customer_type}
 </Badge>
 <Badge
 variant={
 selectedCustomer.risk_grade === "A"
 ? "default"
 : selectedCustomer.risk_grade === "B"
 ? "secondary"
 : "outline"
 }
 >
 Grade {selectedCustomer.risk_grade}
 </Badge>
 {selectedCustomer.credit_score && (
 <Badge variant="outline">
 Score: {selectedCustomer.credit_score}
 </Badge>
 )}
 </div>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setSelectedCustomer(null)}
 >
 Change
 </Button>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Loan Details */}
 <Card>
 <CardHeader>
 <CardTitle>Loan Details</CardTitle>
 <CardDescription>
 Select product and enter loan amount
 </CardDescription>
 </CardHeader>
 <CardContent>
 <FieldGroup>
 <Field>
 <FieldLabel>Loan product</FieldLabel>
 {!hasBorrower ? (
 <p className="text-xs text-muted-foreground mb-2">
 {isGroupMode
 ? "Select a vikundi group first, then choose a loan product."
 : "Select a customer first, then choose a loan product."}
 </p>
 ) : null}
 {productsError ? <p className="text-xs text-destructive mb-2">{productsError}</p> : null}
 {eligibleProductsStrict.length === 0 && eligibleProducts.length > 0 && (
 <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">
 No product matched this customer&apos;s risk grade or credit score; showing all active
 products.
 </p>
 )}
 <Select
 value={selectedProduct?.id || ""}
 onValueChange={(value) => {
 const next = activeLoanProducts.find((p) => String(p.id) === String(value)) || null;
 setSelectedProduct(next);
 if (next) {
 setFormData((prev) => ({
 ...prev,
 repaymentFrequency: normalizeApplicationRepaymentFrequency(
  next.repayment_frequency,
  prev.repaymentFrequency
 ),
 }));
 }
 }}
 disabled={!hasBorrower || productsLoading}
 onOpenChange={(open) => {
 if (open) void loadLoanProducts();
 }}
 >
 <SelectTrigger>
 <SelectValue
 placeholder={
 productsLoading
 ? "Loading products…"
 : !hasBorrower
 ? isGroupMode
 ? "Select group first"
 : "Select customer first"
 : "Select a product"
 }
 />
 </SelectTrigger>
 <SelectContent>
 {eligibleProducts.map((product) => (
 <SelectItem key={product.id} value={String(product.id)}>
 <div className="flex items-center gap-2">
 <span>{product.name}</span>
 <span className="text-muted-foreground">
 ({product.interest_rate}% {product.interest_type})
 </span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {eligibleProducts.length === 0 && hasBorrower && !productsLoading ? (
 <p className="text-sm text-muted-foreground mt-2">
 No active loan products are available. Add products under{" "}
 <Link href="/products" className="text-primary underline">
 Loan Products
 </Link>{" "}
 and open this list again to refresh.
 </p>
 ) : null}
 {selectedProduct && (
 <p className="text-xs text-muted-foreground mt-1">
 {formatCurrency(selectedProduct.min_amount)} - {formatCurrency(selectedProduct.max_amount)} |{" "}
 {selectedProduct.min_term_days} - {selectedProduct.max_term_days} days
 </p>
 )}
 </Field>

 <div className="grid gap-4 sm:grid-cols-2">
 <Field>
 <FieldLabel>Requested Amount (TZS)</FieldLabel>
 <MoneyInput
 placeholder="e.g., 1,000,000"
 value={formData.amount}
 onValueChange={(value) => setFormData({ ...formData, amount: value })}
 disabled={!selectedProduct}
 />
 </Field>
 <Field>
 <FieldLabel>Term (Days)</FieldLabel>
 <Input
 type="number"
 placeholder="e.g., 30"
 value={formData.term}
 onChange={(e) =>
 setFormData({ ...formData, term: e.target.value })
 }
 disabled={!selectedProduct}
 />
 </Field>
 </div>

 <Field>
 <FieldLabel>Repayment frequency</FieldLabel>
 <Select
 value={formData.repaymentFrequency}
 onValueChange={(value) =>
 setFormData({
 ...formData,
 repaymentFrequency: normalizeApplicationRepaymentFrequency(value),
 })
 }
 disabled={!selectedProduct}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select frequency" />
 </SelectTrigger>
 <SelectContent>
 {APPLICATION_REPAYMENT_FREQUENCIES.map((frequency) => (
 <SelectItem key={frequency} value={frequency}>
 {frequency === "daily"
 ? "Daily"
 : frequency === "weekly"
 ? "Weekly"
 : "Monthly"}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="mt-1 text-xs text-muted-foreground">
 Defaults from the product; change if this loan should repay on a different schedule.
 </p>
 </Field>

 <Field>
 <FieldLabel>Purpose of Loan</FieldLabel>
 <Textarea
 placeholder="Describe the purpose of this loan..."
 value={formData.purpose}
 onChange={(e) =>
 setFormData({ ...formData, purpose: e.target.value })
 }
 rows={3}
 />
 </Field>
 </FieldGroup>
 </CardContent>
 </Card>

 <ApplicationCustomerLocationSection
 customer={selectedCustomer}
 group={isGroupMode ? selectedGroup : null}
 value={{
 latitude: formData.latitude,
 longitude: formData.longitude,
 locationLabel: formData.locationLabel,
 }}
 onChange={(next) =>
 setFormData((prev) => ({
 ...prev,
 latitude: next.latitude,
 longitude: next.longitude,
 locationLabel: next.locationLabel,
 }))
 }
 />

 {/* Documents */}
 <Card>
 <CardHeader>
 <CardTitle>Supporting Documents</CardTitle>
 <CardDescription>
 Optional for now — attach one or more files per document type if you have them. Submit will still activate the loan for disbursement.
 </CardDescription>
 </CardHeader>
 <CardContent>
 {selectedProduct ? (
 <RequiredDocumentsFields
 requiredTypes={selectedProduct.required_documents}
 filesByType={documentFiles}
 applicationId={editingApplicationId ?? undefined}
 uploadOnSelect={Boolean(editingApplicationId)}
 onChange={(type, files) =>
 setDocumentFiles((prev) => ({ ...prev, [normalizeDocumentType(type)]: files }))
 }
 />
 ) : (
 <p className="text-sm text-muted-foreground">Select a loan product to see required documents.</p>
 )}
 </CardContent>
 </Card>
 </div>
 {/* Sidebar - Application Actions */}
 <div className="space-y-6">
 <Card className="sticky top-6">
 <CardHeader>
 <CardTitle>Application Actions</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
              {selectedCustomer && selectedProduct && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Customer Analysis Review</p>
                    {analysis && (
                      <Badge
                        variant={
                          analysis.decision === "approve"
                            ? "default"
                            : analysis.decision === "review"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {analysis.decision === "approve"
                          ? "Recommend Approval"
                          : analysis.decision === "review"
                            ? "Manual Review"
                            : "Do Not Recommend"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p>Risk Grade</p>
                      <p className="font-medium text-foreground">{selectedCustomer.risk_grade}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p>Credit Score</p>
                      <p className="font-medium text-foreground">
                        {selectedCustomer.credit_score ?? "Not set"}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p>Monthly Income</p>
                      <p className="font-medium text-foreground">{formatCurrency(combinedIncome)}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p>Est. Installment</p>
                      <p className="font-medium text-foreground">
                        {analysis?.installment ? formatCurrency(analysis.installment) : "-"}
                      </p>
                    </div>
                  </div>
                  {analysis?.ratio !== null && analysis?.ratio !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Installment-to-income ratio: {(analysis.ratio * 100).toFixed(1)}%
                    </p>
                  )}
                  {analysis?.blockers.length ? (
                    <div className="text-xs text-destructive space-y-1">
                      {analysis.blockers.map((item) => (
                        <p key={item}>- {item}</p>
                      ))}
                    </div>
                  ) : null}
                  {analysis?.cautions.length ? (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {analysis.cautions.map((item) => (
                        <p key={item}>- {item}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
 {loanDetails && (
 <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
 Product-based estimate from selected product:{" "}
 {formatCurrency(loanDetails.totalRepayment)} total repayment.
 </div>
 )}

 <Button variant="outline" className="w-full" asChild>
 <Link href={loanCalculatorPath}>Open Standalone Loan Calculator</Link>
 </Button>
 <Button variant="outline" className="w-full" asChild>
 <Link href={creditAnalysisPath}>Go to Credit Analysis</Link>
 </Button>

 <Separator />

 <div className="space-y-2">
 <Button
 type="button"
 className="w-full"
 onClick={() => void handleSubmit(false)}
 disabled={isSaving || !hasBorrower || !selectedProduct || amount <= 0 || termDays <= 0}
 >
 <Send className="mr-2 h-4 w-4" />
 {isSaving
 ? "Saving…"
 : isAdminView
 ? "Activate & create loan"
 : "Submit application"}
 </Button>
 <Button
 type="button"
 variant="outline"
 className="w-full"
 onClick={() => void handleSubmit(true)}
 disabled={isSaving || !hasBorrower || !selectedProduct}
 >
 {isSaving ? "Saving…" : "Save as draft"}
 </Button>
 {!hasBorrower || !selectedProduct ? (
 <p className="text-xs text-muted-foreground">
 {isGroupMode
 ? "Choose a vikundi group and a loan product. Amount and term must be greater than zero to submit."
 : "Choose a customer and a loan product. Amount and term must be greater than zero to submit."}
 </p>
 ) : amount <= 0 || termDays <= 0 ? (
 <p className="text-xs text-muted-foreground">
 Enter requested amount and term (days) above — both must be greater than zero to submit.
 </p>
 ) : null}
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 </main>
 </>
 );
}

export default function NewApplicationPage() {
 return (
 <Suspense fallback={<NewApplicationPageFallback />}>
 <NewApplicationPageContent />
 </Suspense>
 );
}
