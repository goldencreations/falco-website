"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, Loader2, RefreshCcw } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
  type CalculatorPreviewForm,
  type CalculatorResultView,
} from "@/lib/calculator-adapters";
import { formatApiResponseError } from "@/lib/falco-api";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { extractProductsList } from "@/lib/product-adapters";
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

function frequencyLabel(value: string): string {
  if (value === "weekly") return "Weekly";
  if (value === "daily") return "Daily";
  if (value === "bi_weekly") return "Bi-weekly";
  return "Monthly";
}

function interestTypeLabel(value: string): string {
  return value === "flat" || value === "flat_interest" ? "Flat interest" : "Declining balance";
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

function ResultBreakdown({
  result,
  latePaymentPenaltyPercent,
}: {
  result: CalculatorResultView;
  latePaymentPenaltyPercent?: number;
}) {
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
            <p className="text-xs text-muted-foreground">Interest ({result.interestRate}% / mo)</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(result.interestAmount)}</p>
          </div>
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
            <p className="text-xs text-muted-foreground">Total repayment</p>
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

  const runPreview = async () => {
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
          ? "Enter loan amount and term (days) within the product limits."
          : "Enter loan amount and period (months) to calculate."
      );
      setResult(null);
      return;
    }

    setCalculating(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : "Calculation failed");
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
        description="Product-backed previews and manual simulations via POST /calculator/preview"
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
                  Uses product interest, processing fee & insurance from the server
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
                    product. Client overrides are ignored by the API.
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
                        <FieldLabel>Loan amount (TZS)</FieldLabel>
                        <MoneyInput
                          value={form.principal}
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, principal: value }))
                          }
                          placeholder="e.g., 1,000,000"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Loan term (days)</FieldLabel>
                        <Input
                          type="number"
                          min={activeProduct?.min_term_days ?? 1}
                          max={activeProduct?.max_term_days ?? undefined}
                          value={form.termDays}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, termDays: e.target.value }))
                          }
                          placeholder={
                            activeProduct
                              ? `${activeProduct.min_term_days}–${activeProduct.max_term_days}`
                              : "e.g., 90"
                          }
                        />
                      </Field>
                      <Field className="md:col-span-2">
                        <FieldLabel>Start date</FieldLabel>
                        <Input
                          type="date"
                          value={form.startDate}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, startDate: e.target.value }))
                          }
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
                    Enter principal, term, interest, and fee percentages. Required fields match the
                    Falco manual preview schema.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Loan inputs</p>
                    <FieldGroup>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field>
                          <FieldLabel>Loan amount (TZS)</FieldLabel>
                          <MoneyInput
                            value={form.principal}
                            onValueChange={(value) =>
                              setForm((prev) => ({ ...prev, principal: value }))
                            }
                            placeholder="e.g., 1,000,000"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Loan period (months)</FieldLabel>
                          <Input
                            type="number"
                            min={1}
                            value={form.loanPeriodMonths}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, loanPeriodMonths: e.target.value }))
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Repayment frequency</FieldLabel>
                          <Select
                            value={form.repaymentFrequency}
                            onValueChange={(value) =>
                              setForm((prev) => ({
                                ...prev,
                                repaymentFrequency: value as CalculatorPreviewForm["repaymentFrequency"],
                              }))
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
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, startDate: e.target.value }))
                            }
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
                            onValueChange={(value) =>
                              setForm((prev) => ({ ...prev, interestType: value }))
                            }
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
                            max={100}
                            value={form.interestRatePerMonth}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                interestRatePerMonth: e.target.value,
                              }))
                            }
                          />
                        </Field>
                      </div>
                    </FieldGroup>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Processing & insurance fees</p>
                    <p className="text-xs text-muted-foreground">
                      Processing fee and insurance fee are percentages of principal in manual mode.
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
                            max={100}
                            value={form.processingFeePercent}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                processingFeePercent: e.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Insurance fee (%)</FieldLabel>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            value={form.insuranceFeePercent}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                insuranceFeePercent: e.target.value,
                              }))
                            }
                          />
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
              disabled={loadingProducts}
              onClick={() => forceCachedReload(loadProducts)}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh products
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
