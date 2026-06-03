"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Loader2, RefreshCcw } from "lucide-react";
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
 setForm((prev) => ({
 ...prev,
 productId: prev.productId || list[0]?.id || "",
 }));
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
 const payload = mapUiCalculatorPreviewToApi(form);
 if (!payload) {
 setError("Enter loan amount and period (months) to calculate.");
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

 return (
 <>
 <DashboardHeader
 title="Loan Calculator"
 description="Product-backed and manual repayment previews from the Falco pricing engine"
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-5xl space-y-6">
 {error && (
 <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
 {error}
 </div>
 )}

 <Tabs
 value={form.mode}
 onValueChange={(value) =>
 setForm((prev) => ({
 ...prev,
 mode: value as "product" | "manual",
 }))
 }
 >
 <TabsList>
 <TabsTrigger value="product">Product-backed</TabsTrigger>
 <TabsTrigger value="manual">Manual simulation</TabsTrigger>
 </TabsList>

 <TabsContent value="product" className="mt-4 space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Calculator className="h-5 w-5" />
 Product-backed preview
 </CardTitle>
 <CardDescription>
 Uses live product rates, fees, and bounds from the backend (overrides are ignored).
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <FieldGroup>
 <div className="grid gap-4 sm:grid-cols-2">
 <Field>
 <FieldLabel>Loan product</FieldLabel>
 <Select
 value={form.productId}
 disabled={loadingProducts}
 onValueChange={(value) =>
 setForm((prev) => ({ ...prev, productId: value }))
 }
 >
 <SelectTrigger>
 <SelectValue placeholder={loadingProducts ? "Loading…" : "Select product"} />
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
 onValueChange={(value) => setForm((prev) => ({ ...prev, principal: value }))}
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

 {loadingDefaults && (
 <p className="text-xs text-muted-foreground">Loading product settings…</p>
 )}
 {boundsHint && (
 <p className="text-xs text-muted-foreground">{boundsHint}</p>
 )}
 {activeProduct && !loadingDefaults && (
 <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
 <p>
 Rate {activeProduct.interest_rate_per_month ?? "—"}% / month ·{" "}
 {interestTypeLabel(activeProduct.interest_type)} ·{" "}
 {frequencyLabel(activeProduct.repayment_frequency)}
 </p>
 <p>
 Processing {activeProduct.processing_fee_percent}% · Insurance{" "}
 {activeProduct.insurance_fee_percent}%
 </p>
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="manual" className="mt-4 space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Calculator className="h-5 w-5" />
 Manual simulation
 </CardTitle>
 <CardDescription>
 Officer exploration with custom rate, fees, and frequency (not tied to a product).
 </CardDescription>
 </CardHeader>
 <CardContent>
 <FieldGroup>
 <div className="grid gap-4 sm:grid-cols-2">
 <Field>
 <FieldLabel>Loan amount (TZS)</FieldLabel>
 <MoneyInput
 value={form.principal}
 onValueChange={(value) => setForm((prev) => ({ ...prev, principal: value }))}
 placeholder="e.g., 1,000,000"
 />
 </Field>
 <Field>
 <FieldLabel>Loan period (months)</FieldLabel>
 <Input
 type="number"
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
 value={form.interestRatePerMonth}
 onChange={(e) =>
 setForm((prev) => ({ ...prev, interestRatePerMonth: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Processing fee (%)</FieldLabel>
 <Input
 type="number"
 step="0.01"
 value={form.processingFeePercent}
 onChange={(e) =>
 setForm((prev) => ({ ...prev, processingFeePercent: e.target.value }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Insurance fee (%)</FieldLabel>
 <Input
 type="number"
 step="0.01"
 value={form.insuranceFeePercent}
 onChange={(e) =>
 setForm((prev) => ({ ...prev, insuranceFeePercent: e.target.value }))
 }
 />
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
 Calculate
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

 {result && (
 <Card>
 <CardHeader>
 <CardTitle>Calculation result</CardTitle>
 <CardDescription>
 {result.termDays != null && `${result.termDays} days`}
 {result.loanPeriodMonths != null && ` · ${result.loanPeriodMonths} months`} ·{" "}
 {frequencyLabel(result.repaymentFrequency)} ·{" "}
 {interestTypeLabel(result.interestType)}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-3 text-sm sm:grid-cols-2">
 <div className="flex justify-between sm:block">
 <span className="text-muted-foreground">Principal</span>
 <span className="font-medium sm:mt-1">{formatCurrency(result.principal)}</span>
 </div>
 <div className="flex justify-between sm:block">
 <span className="text-muted-foreground">Interest ({result.interestRate}% / mo)</span>
 <span className="font-medium sm:mt-1">{formatCurrency(result.interestAmount)}</span>
 </div>
 <div className="flex justify-between sm:block">
 <span className="text-muted-foreground">Processing fee</span>
 <span className="font-medium sm:mt-1">{formatCurrency(result.processingFee)}</span>
 </div>
 <div className="flex justify-between sm:block">
 <span className="text-muted-foreground">Insurance fee</span>
 <span className="font-medium sm:mt-1">{formatCurrency(result.insuranceFee)}</span>
 </div>
 <div className="flex justify-between sm:block">
 <span className="text-muted-foreground">Total fees</span>
 <span className="font-medium sm:mt-1">{formatCurrency(result.totalFees)}</span>
 </div>
 <div className="flex justify-between sm:block">
 <span className="text-muted-foreground">Installments</span>
 <span className="font-medium sm:mt-1">{result.repaymentCount}</span>
 </div>
 </div>

 <Separator />

 <div className="flex flex-wrap items-end justify-between gap-4">
 <div>
 <p className="text-xs text-muted-foreground">Installment amount</p>
 <p className="text-2xl font-bold text-primary">
 {formatCurrency(result.installmentAmount)}
 </p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Total repayment</p>
 <p className="text-2xl font-bold">{formatCurrency(result.totalRepayment)}</p>
 </div>
 </div>

 {result.firstRepaymentDate && (
 <p className="text-xs text-muted-foreground">
 First repayment: {formatDate(result.firstRepaymentDate)}
 </p>
 )}

 {result.schedulePreview.length > 0 && (
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
 )}
 </CardContent>
 </Card>
 )}
 </div>
 </main>
 </>
 );
}

