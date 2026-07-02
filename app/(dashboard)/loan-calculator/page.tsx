"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, Loader2, RefreshCcw } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  apiInterestTypeToUi,
  extractCalculatorProductDefaults,
  extractCalculatorResult,
  getProductCalculatorValidationError,
  mapUiCalculatorPreviewToApi,
  termDaysFromLoanPeriodMonths,
  type CalculatorPreviewForm,
  type CalculatorResultView,
} from "@/lib/calculator-adapters";
import { formatApiResponseError } from "@/lib/falco-api";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { extractProductsList } from "@/lib/product-adapters";
import { parseMoneyInput } from "@/lib/money-input";
import type { LoanProduct } from "@/lib/types";

const defaultForm: CalculatorPreviewForm = {
  mode: "manual",
  productId: "",
  principal: "",
  termDays: "",
  loanPeriodMonths: "",
  repaymentFrequency: "monthly",
  interestType: "declining_balance",
  interestRatePerMonth: "",
  processingFeePercent: "",
  insuranceFeePercent: "",
  startDate: new Date().toISOString().slice(0, 10),
};

type CalculatorFieldErrors = Partial<Record<keyof CalculatorPreviewForm, string>>;

function frequencyLabel(value: string): string {
  if (value === "weekly") return "Weekly";
  if (value === "daily") return "Daily";
  if (value === "bi_weekly") return "Bi-weekly";
  return "Monthly";
}

function interestTypeLabel(value: string): string {
  return value === "flat" || value === "flat_interest" ? "Flat interest" : "Declining balance";
}

function simpleCalculatorError(message: string): string {
  return message.replaceAll("_", " ");
}

function ProductPricingSummary({ product }: { product: LoanProduct }) {
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-2">
      <p>
        <span className="text-muted-foreground">Interest:</span>{" "}
        <span className="font-medium">
          {product.interest_rate_per_month ?? "—"}% / month ·{" "}
          {interestTypeLabel(product.interest_type)}
        </span>
      </p>
      <p>
        <span className="text-muted-foreground">Repayment:</span>{" "}
        <span className="font-medium">{frequencyLabel(product.repayment_frequency)}</span>
      </p>
      <p>
        <span className="text-muted-foreground">Processing fee:</span>{" "}
        <span className="font-medium">{product.processing_fee_percent}%</span>
      </p>
      <p>
        <span className="text-muted-foreground">Insurance fee:</span>{" "}
        <span className="font-medium">{product.insurance_fee_percent}%</span>
      </p>
      <p>
        <span className="text-muted-foreground">Late payment penalty:</span>{" "}
        <span className="font-medium">{product.late_payment_fee_percent}%</span>
      </p>
      <p>
        <span className="text-muted-foreground">Grace period:</span>{" "}
        <span className="font-medium">{product.grace_period_days} days</span>
      </p>
    </div>
  );
}

function repaymentCountForManual(
  frequency: CalculatorPreviewForm["repaymentFrequency"],
  termDays: number,
  months: number
) {
  if (frequency === "daily") return Math.max(1, termDays);
  if (frequency === "weekly") return Math.max(1, Math.ceil(termDays / 7));
  if (frequency === "bi_weekly") return Math.max(1, Math.ceil(termDays / 14));
  return Math.max(1, Math.round(months));
}

function normalizePercentInput(value: string): number {
  const numeric = Math.max(0, Number(value) || 0);
  return numeric > 100 ? numeric / 100 : numeric;
}

function normalizeInsuranceInput(value: string): number {
  const numeric = Math.max(0, Number(value) || 0);
  if (numeric > 0 && numeric < 1) return numeric * 100;
  return normalizePercentInput(value);
}

function applyManualFormula(
  form: CalculatorPreviewForm,
  parsed?: CalculatorResultView
): CalculatorResultView {
  const principal = Number(parseMoneyInput(form.principal));
  const months = Math.max(1, Math.round(Number(form.loanPeriodMonths) || 0));
  const termDays = termDaysFromLoanPeriodMonths(months);
  const interestRate = normalizePercentInput(form.interestRatePerMonth);
  const processingFeePercent = normalizePercentInput(form.processingFeePercent);
  const insuranceFeePercent = normalizeInsuranceInput(form.insuranceFeePercent);
  const processingFee = principal * (processingFeePercent / 100);
  const insuranceFee = principal * (insuranceFeePercent / 100);
  const interestOnPrincipal = principal * (interestRate / 100) * months;
  const interestOnProcessingFee = processingFee * (interestRate / 100) * months;
  const interestAmount = interestOnPrincipal + interestOnProcessingFee;
  const totalRepayment =
    principal + processingFee + interestOnProcessingFee + interestOnPrincipal + insuranceFee;
  const repaymentCount = repaymentCountForManual(form.repaymentFrequency, termDays, months);
  const installmentAmount = totalRepayment / repaymentCount;
  const principalDue = principal / repaymentCount;
  const interestDue = interestAmount / repaymentCount;
  const feesDue = (processingFee + insuranceFee) / repaymentCount;
  const schedulePreview = (parsed?.schedulePreview ?? []).map((row, index) => ({
    ...row,
    installmentNumber: row.installmentNumber || index + 1,
    principalDue,
    interestDue,
    feesDue,
    totalDue: installmentAmount,
  }));

  return {
    ...(parsed ?? {}),
    principal,
    termDays,
    loanPeriodMonths: months,
    interestRate,
    interestType: "flat",
    interestAmount,
    interestOnPrincipal,
    interestOnProcessingFee,
    processingFee,
    insuranceFee,
    totalFees: processingFee + insuranceFee,
    totalRepayment,
    installmentAmount,
    repaymentCount,
    repaymentFrequency: form.repaymentFrequency,
    firstRepaymentDate: parsed?.firstRepaymentDate,
    penaltyAmount: parsed?.penaltyAmount,
    schedulePreview,
  };
}

function ResultBreakdown({
  result,
  latePaymentPenaltyPercent,
}: {
  result: CalculatorResultView;
  latePaymentPenaltyPercent?: number;
}) {
  const usesManualFormula =
    result.interestOnPrincipal != null || result.interestOnProcessingFee != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculation result</CardTitle>
        <CardDescription>
          {result.termDays != null && `${result.termDays} days`}
          {result.loanPeriodMonths != null && ` · ${result.loanPeriodMonths} months`} ·{" "}
          {frequencyLabel(result.repaymentFrequency)} · {interestTypeLabel(result.interestType)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Principal</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(result.principal)}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">
              {usesManualFormula ? "Interest on principal" : "Interest"} ({result.interestRate}% / mo)
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(result.interestOnPrincipal ?? result.interestAmount)}
            </p>
          </div>
          {usesManualFormula ? (
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Interest on processing fee</p>
              <p className="mt-1 text-lg font-semibold">
                {formatCurrency(result.interestOnProcessingFee ?? 0)}
              </p>
            </div>
          ) : null}
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Processing fee</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(result.processingFee)}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Insurance fee</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(result.insuranceFee)}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Total fees</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(result.totalFees)}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Installments</p>
            <p className="mt-1 text-lg font-semibold">{result.repaymentCount}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Installment amount</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(result.installmentAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {usesManualFormula ? "Total Loan" : "Total repayment"}
            </p>
            <p className="text-2xl font-bold">{formatCurrency(result.totalRepayment)}</p>
          </div>
        </div>

        {result.firstRepaymentDate ? (
          <p className="text-xs text-muted-foreground">
            First repayment: {formatDate(result.firstRepaymentDate)}
          </p>
        ) : null}

        {(result.penaltyAmount != null && result.penaltyAmount > 0) ||
        (latePaymentPenaltyPercent != null && latePaymentPenaltyPercent > 0) ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Late payment penalty</p>
              {result.penaltyAmount != null && result.penaltyAmount > 0 ? (
                <p>Penalty in this preview: {formatCurrency(result.penaltyAmount)}</p>
              ) : null}
              {latePaymentPenaltyPercent != null && latePaymentPenaltyPercent > 0 ? (
                <p>
                  Product late-payment penalty rate: {latePaymentPenaltyPercent}% (applied when
                  installments are overdue, not included in the schedule preview above).
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Penalties for overdue installments are charged at repayment per product policy and are
            not part of the standard installment schedule preview.
          </p>
        )}

        {result.schedulePreview.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.schedulePreview.map((row) => (
                  <TableRow key={row.installmentNumber}>
                    <TableCell>{row.installmentNumber}</TableCell>
                    <TableCell>{formatDate(row.dueDate)}</TableCell>
                    <TableCell className="text-right">
                      {row.principalDue != null ? formatCurrency(row.principalDue) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.interestDue != null ? formatCurrency(row.interestDue) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.feesDue != null ? formatCurrency(row.feesDue) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.totalDue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function LoanCalculatorPage() {
  const [form, setForm] = useState<CalculatorPreviewForm>(defaultForm);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [productDefaults, setProductDefaults] = useState<LoanProduct | null>(null);
  const [result, setResult] = useState<CalculatorResultView | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CalculatorFieldErrors>({});

  const activeProduct = useMemo(
    () => products.find((p) => p.id === form.productId) ?? productDefaults,
    [products, form.productId, productDefaults]
  );

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/falco/products?is_active=true", {
        credentials: "include",
        cache: "no-store",
      });
      const { data } = await parseJsonResponse<unknown>(res);
      if (!res.ok) {
        throw new Error(formatApiResponseError(data, "Failed to load loan products"));
      }
      const list = extractProductsList(data).filter((p) => p.is_active);
      setProducts(list);
      setForm((prev) => {
        const nextProductId = prev.productId || list[0]?.id || "";
        const nextProduct = list.find((p) => p.id === nextProductId);
        return {
          ...prev,
          productId: nextProductId,
          termDays:
            prev.termDays.trim() || (nextProduct ? String(nextProduct.min_term_days) : ""),
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadProductDefaults = useCallback(async (productId: string) => {
    if (!productId) {
      setProductDefaults(null);
      return;
    }
    setLoadingDefaults(true);
    try {
      const res = await fetch(`/api/calculator/products/${encodeURIComponent(productId)}/defaults`, {
        credentials: "include",
        cache: "no-store",
      });
      const { data } = await parseJsonResponse<unknown>(res);
      if (!res.ok) {
        throw new Error(formatApiResponseError(data, "Failed to load product defaults"));
      }
      const defaults = extractCalculatorProductDefaults(data);
      if (!defaults) throw new Error("Unexpected product defaults response");
      setProductDefaults(defaults.product);
      setForm((prev) => ({
        ...prev,
        termDays: String(defaults.product.min_term_days),
        repaymentFrequency: defaults.product.repayment_frequency,
        interestType: apiInterestTypeToUi(defaults.product.interest_type),
        interestRatePerMonth: String(defaults.product.interest_rate_per_month ?? ""),
        processingFeePercent: String(defaults.product.processing_fee_percent ?? ""),
        insuranceFeePercent: String(defaults.product.insurance_fee_percent ?? ""),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load product settings");
      setProductDefaults(null);
    } finally {
      setLoadingDefaults(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (form.mode === "product" && form.productId) {
      void loadProductDefaults(form.productId);
    }
  }, [form.mode, form.productId, loadProductDefaults]);

  const updateForm = <K extends keyof CalculatorPreviewForm>(
    key: K,
    value: CalculatorPreviewForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const resetCalculatorValues = () => {
    setForm((prev) => ({
      ...prev,
      principal: "0",
      termDays: "0",
      loanPeriodMonths: "0",
      interestRatePerMonth: "0",
      processingFeePercent: "0",
      insuranceFeePercent: "0",
    }));
    setError(null);
    setFieldErrors({});
    setResult(null);
  };

  const validateCalculatorFields = (): CalculatorFieldErrors => {
    const next: CalculatorFieldErrors = {};
    const principal = Number(parseMoneyInput(form.principal));
    if (!Number.isFinite(principal) || principal <= 0) {
      next.principal = "Principal Amount must be more than 0.";
    }

    if (form.mode === "product") {
      const termDays = Number(form.termDays);
      if (!Number.isFinite(termDays) || termDays <= 0) {
        next.termDays = "Loan term must be more than 0 days.";
      }
      return next;
    }

    const loanPeriodMonths = Number(form.loanPeriodMonths);
    const interestRate = Number(form.interestRatePerMonth);
    const processingFee = Number(form.processingFeePercent);
    const insuranceFee = Number(form.insuranceFeePercent);

    if (!Number.isFinite(loanPeriodMonths) || loanPeriodMonths <= 0) {
      next.loanPeriodMonths = "Loan period must be more than 0 months.";
    }
    if (!Number.isFinite(interestRate) || interestRate < 0) {
      next.interestRatePerMonth = "Interest rate must be 0% or more.";
    }
    if (!Number.isFinite(processingFee) || processingFee < 0) {
      next.processingFeePercent = "Processing fee must be 0% or more.";
    }
    if (!Number.isFinite(insuranceFee) || insuranceFee < 0) {
      next.insuranceFeePercent = "Insurance fee must be 0% or more.";
    }
    return next;
  };

  const runPreview = async () => {
    const validationErrors = validateCalculatorFields();
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0] ?? "Fix the highlighted fields.";
      setFieldErrors(validationErrors);
      setError(firstError);
      setResult(null);
      return;
    }

    if (form.mode === "manual") {
      setError(null);
      setFieldErrors({});
      setResult(applyManualFormula(form));
      return;
    }

    if (form.mode === "product") {
      const validationError = getProductCalculatorValidationError(form, activeProduct);
      if (validationError) {
        setError(validationError);
        setResult(null);
        return;
      }
    }

    const payload = mapUiCalculatorPreviewToApi(form, activeProduct);
    if (!payload) {
      setError(
        form.mode === "product"
          ? "Enter Principal Amount and term (days) within the product limits."
          : "Enter Principal Amount and period (months) to calculate."
      );
      setResult(null);
      return;
    }

    setCalculating(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/calculator/preview", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { data } = await parseJsonResponse<unknown>(res);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Your session expired. Please sign in again.");
        }
        throw new Error(formatApiResponseError(data, "Calculation failed"));
      }
      const parsed = extractCalculatorResult(data);
      if (!parsed) throw new Error("Unexpected calculation response");
      setResult(parsed);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? simpleCalculatorError(e.message) : "Calculation failed");
    } finally {
      setCalculating(false);
    }
  };

  const boundsHint = activeProduct
    ? `Amount ${formatCurrency(activeProduct.min_amount)} – ${formatCurrency(activeProduct.max_amount)} · Term ${activeProduct.min_term_days}–${activeProduct.max_term_days} days`
    : null;

  const penaltyPercentForResult =
    form.mode === "product" && activeProduct ? activeProduct.late_payment_fee_percent : undefined;

  return (
    <>
      <DashboardHeader
        title="Loan Calculator"
        description="Preview principal amounts, repayment terms, and charges before applying."
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Tabs
            value={form.mode}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                mode: value as "product" | "manual",
              }))
            }
            className="space-y-4"
          >
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-muted/50 p-1 sm:grid-cols-2">
              <TabsTrigger
                value="product"
                className="h-auto min-h-11 flex-col items-start gap-0.5 px-3 py-2.5 text-left data-[state=active]:bg-background"
              >
                <span className="text-sm font-medium">Product-backed preview</span>
                <span className="text-[11px] font-normal leading-snug text-muted-foreground">
                  Uses product interest, processing fee, and insurance settings
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="h-auto min-h-11 flex-col items-start gap-0.5 px-3 py-2.5 text-left data-[state=active]:bg-background"
              >
                <span className="text-sm font-medium">Manual simulation</span>
                <span className="text-[11px] font-normal leading-snug text-muted-foreground">
                  Officer exploration with custom rates and processing fees
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="product" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Calculator className="h-5 w-5 shrink-0" />
                    Product-backed preview
                  </CardTitle>
                  <CardDescription>
                    Select a loan product — processing fee, insurance, and interest come from the
                    product. Custom rates are only used in manual simulation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FieldGroup>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field className="md:col-span-2">
                        <FieldLabel>Loan product</FieldLabel>
                        <Select
                          value={form.productId}
                          disabled={loadingProducts}
                          onValueChange={(value) => {
                            const product = products.find((item) => item.id === value);
                            setForm((prev) => ({
                              ...prev,
                              productId: value,
                              termDays: product ? String(product.min_term_days) : prev.termDays,
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={loadingProducts ? "Loading…" : "Select product"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                                {product.code ? ` (${product.code})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                        <Field>
                          <FieldLabel>Principal Amount (TZS)</FieldLabel>
                          <MoneyInput
                            value={form.principal}
                            onValueChange={(value) => updateForm("principal", value)}
                            placeholder="e.g., 1,000,000"
                            className={fieldErrors.principal ? "border-destructive" : undefined}
                            title={fieldErrors.principal}
                          />
                          {fieldErrors.principal ? <FieldError>{fieldErrors.principal}</FieldError> : null}
                        </Field>
                        <Field>
                          <FieldLabel>Loan term (days)</FieldLabel>
                        <Input
                          type="number"
                          min={activeProduct?.min_term_days ?? 1}
                          max={activeProduct?.max_term_days ?? undefined}
                          value={form.termDays}
                          onChange={(e) => updateForm("termDays", e.target.value)}
                          className={fieldErrors.termDays ? "border-destructive" : undefined}
                          title={fieldErrors.termDays}
                          placeholder={
                            activeProduct
                              ? `${activeProduct.min_term_days}–${activeProduct.max_term_days}`
                              : "e.g., 90"
                          }
                        />
                        {fieldErrors.termDays ? <FieldError>{fieldErrors.termDays}</FieldError> : null}
                      </Field>
                      <Field className="md:col-span-2">
                        <FieldLabel>Start date</FieldLabel>
                        <Input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => updateForm("startDate", e.target.value)}
                        />
                      </Field>
                    </div>
                  </FieldGroup>

                  {loadingDefaults ? (
                    <p className="text-xs text-muted-foreground">Loading product settings…</p>
                  ) : null}
                  {boundsHint ? (
                    <p className="text-xs text-muted-foreground">{boundsHint}</p>
                  ) : null}
                  {activeProduct && !loadingDefaults ? (
                    <ProductPricingSummary product={activeProduct} />
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manual" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Calculator className="h-5 w-5 shrink-0" />
                    Manual simulation
                  </CardTitle>
                  <CardDescription>
                    Total Loan = Principal Amount + Processing Fee Amount + Interest on Processing
                    Fee + Interest on Principal Amount + Insurance Amount.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Loan inputs</p>
                    <FieldGroup>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field>
                          <FieldLabel>Principal Amount (TZS)</FieldLabel>
                          <MoneyInput
                            value={form.principal}
                            onValueChange={(value) => updateForm("principal", value)}
                            placeholder="e.g., 1,000,000"
                            className={fieldErrors.principal ? "border-destructive" : undefined}
                            title={fieldErrors.principal}
                          />
                          {fieldErrors.principal ? <FieldError>{fieldErrors.principal}</FieldError> : null}
                        </Field>
                        <Field>
                          <FieldLabel>Loan period (months)</FieldLabel>
                          <Input
                            type="number"
                            min={1}
                            value={form.loanPeriodMonths}
                            onChange={(e) => updateForm("loanPeriodMonths", e.target.value)}
                            className={fieldErrors.loanPeriodMonths ? "border-destructive" : undefined}
                            title={fieldErrors.loanPeriodMonths}
                          />
                          {fieldErrors.loanPeriodMonths ? (
                            <FieldError>{fieldErrors.loanPeriodMonths}</FieldError>
                          ) : null}
                        </Field>
                        <Field>
                          <FieldLabel>Repayment frequency</FieldLabel>
                          <Select
                            value={form.repaymentFrequency}
                            onValueChange={(value) =>
                              updateForm(
                                "repaymentFrequency",
                                value as CalculatorPreviewForm["repaymentFrequency"]
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="bi_weekly">Bi-weekly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field>
                          <FieldLabel>Start date</FieldLabel>
                          <Input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => updateForm("startDate", e.target.value)}
                        />
                        </Field>
                      </div>
                    </FieldGroup>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Interest</p>
                    <FieldGroup>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field>
                          <FieldLabel>Interest type</FieldLabel>
                          <Select
                            value={form.interestType}
                            onValueChange={(value) => updateForm("interestType", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="declining_balance">Declining balance</SelectItem>
                              <SelectItem value="flat_interest">Flat interest</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field>
                          <FieldLabel>Interest rate (% per month)</FieldLabel>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={form.interestRatePerMonth}
                            onChange={(e) => updateForm("interestRatePerMonth", e.target.value)}
                            className={fieldErrors.interestRatePerMonth ? "border-destructive" : undefined}
                            title={fieldErrors.interestRatePerMonth}
                          />
                          {fieldErrors.interestRatePerMonth ? (
                            <FieldError>{fieldErrors.interestRatePerMonth}</FieldError>
                          ) : null}
                        </Field>
                      </div>
                    </FieldGroup>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Processing & insurance fees</p>
                    <p className="text-xs text-muted-foreground">
                      Processing fee and insurance fee are percentages of the principal amount.
                      Late payment penalties are not simulated here — they apply when installments
                      are overdue.
                    </p>
                    <FieldGroup>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field>
                          <FieldLabel>Processing fee (%)</FieldLabel>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={form.processingFeePercent}
                            onChange={(e) => updateForm("processingFeePercent", e.target.value)}
                            className={fieldErrors.processingFeePercent ? "border-destructive" : undefined}
                            title={fieldErrors.processingFeePercent}
                          />
                          {fieldErrors.processingFeePercent ? (
                            <FieldError>{fieldErrors.processingFeePercent}</FieldError>
                          ) : null}
                        </Field>
                        <Field>
                          <FieldLabel>Insurance fee (%)</FieldLabel>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={form.insuranceFeePercent}
                            onChange={(e) => updateForm("insuranceFeePercent", e.target.value)}
                            className={fieldErrors.insuranceFeePercent ? "border-destructive" : undefined}
                            title={fieldErrors.insuranceFeePercent}
                          />
                          {fieldErrors.insuranceFeePercent ? (
                            <FieldError>{fieldErrors.insuranceFeePercent}</FieldError>
                          ) : null}
                        </Field>
                      </div>
                    </FieldGroup>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={calculating}
              onClick={() => void runPreview()}
            >
              {calculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating…
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculate preview
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetCalculatorValues}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reset values
            </Button>
          </div>

          {result ? (
            <ResultBreakdown
              result={result}
              latePaymentPenaltyPercent={penaltyPercentForResult}
            />
          ) : null}
        </div>
      </main>
    </>
  );
}
