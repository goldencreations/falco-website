"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Edit, Percent, Calendar, Wallet } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { formatValidationDetails } from "@/lib/falco-api";
import { extractProductsList } from "@/lib/product-adapters";
import { buildProductCreateApiBody } from "@/lib/product-payload";
import type { LoanProduct, RiskGrade } from "@/lib/types";

const RISK_TOGGLE: RiskGrade[] = ["A", "B", "C", "D"];

type CreateForm = {
 name: string;
 code: string;
 min_amount: string;
 max_amount: string;
 min_term_days: string;
 max_term_days: string;
 interest_type: "flat" | "reducing_balance";
 interest_rate_per_month: string;
 processing_fee_percent: string;
 insurance_fee_percent: string;
 repayment_frequency: "daily" | "weekly" | "bi_weekly" | "monthly";
 grace_period_days: string;
 required_documents_csv: string;
 allowed_risk_grades: RiskGrade[];
 is_active: boolean;
};

const defaultCreateForm: CreateForm = {
 name: "",
 code: "",
 min_amount: "100000",
 max_amount: "5000000",
 min_term_days: "30",
 max_term_days: "180",
 interest_type: "flat",
 interest_rate_per_month: "6",
 processing_fee_percent: "2",
 insurance_fee_percent: "1",
 repayment_frequency: "monthly",
 grace_period_days: "3",
 required_documents_csv: "national_id, business_license",
 allowed_risk_grades: ["A", "B"],
 is_active: true,
};

export default function ProductsPage() {
 const router = useRouter();
 const [searchQuery, setSearchQuery] = useState("");
 const [includeInactive, setIncludeInactive] = useState(false);
 const [products, setProducts] = useState<LoanProduct[]>([]);
 const [loading, setLoading] = useState(true);
 const [listError, setListError] = useState("");
 const [createOpen, setCreateOpen] = useState(false);
 const [createForm, setCreateForm] = useState<CreateForm>(defaultCreateForm);
 const [createError, setCreateError] = useState("");
 const [createSaving, setCreateSaving] = useState(false);
 const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
 const [editForm, setEditForm] = useState<CreateForm>(defaultCreateForm);
 const [editError, setEditError] = useState("");
 const [editSaving, setEditSaving] = useState(false);

 const loadProducts = useCallback(async () => {
 setLoading(true);
 setListError("");
 try {
 const q = new URLSearchParams({ is_active: includeInactive ? "false" : "true" });
 const r = await fetch(`/api/falco/products?${q.toString()}`, { credentials: "include" });
 const json = await r.json().catch(() => ({}));
 if (!r.ok) {
 if (r.status === 401) {
 router.replace("/login");
 return;
 }
 setListError(typeof json.message === "string" ? json.message : `Could not load products (${r.status})`);
 setProducts([]);
 return;
 }
 setProducts(extractProductsList(json));
 } catch {
 setListError("Network error");
 setProducts([]);
 } finally {
 setLoading(false);
 }
 }, [includeInactive, router]);

 useEffect(() => {
 void loadProducts();
 }, [loadProducts]);

 const filteredProducts = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 if (!q) return products;
 return products.filter(
 (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
 );
 }, [products, searchQuery]);

 const updateCreate = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => {
 setCreateForm((prev) => ({ ...prev, [key]: value }));
 };

 const updateEdit = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => {
 setEditForm((prev) => ({ ...prev, [key]: value }));
 };

 const toggleRisk = (grade: RiskGrade) => {
 setCreateForm((prev) => {
 const has = prev.allowed_risk_grades.includes(grade);
 const next = has ? prev.allowed_risk_grades.filter((g) => g !== grade) : [...prev.allowed_risk_grades, grade];
 return { ...prev, allowed_risk_grades: next };
 });
 };

 const toggleEditRisk = (grade: RiskGrade) => {
 setEditForm((prev) => {
 const has = prev.allowed_risk_grades.includes(grade);
 const next = has ? prev.allowed_risk_grades.filter((g) => g !== grade) : [...prev.allowed_risk_grades, grade];
 return { ...prev, allowed_risk_grades: next };
 });
 };

 const productToForm = (product: LoanProduct): CreateForm => ({
 name: product.name,
 code: product.code,
 min_amount: String(product.min_amount),
 max_amount: String(product.max_amount),
 min_term_days: String(product.min_term_days),
 max_term_days: String(product.max_term_days),
 interest_type: product.interest_type,
 interest_rate_per_month: String(product.interest_rate_per_month ?? product.interest_rate / 12),
 processing_fee_percent: String(product.processing_fee_percent),
 insurance_fee_percent: String(product.insurance_fee_percent),
 repayment_frequency: product.repayment_frequency,
 grace_period_days: String(product.grace_period_days),
 required_documents_csv: product.required_documents.join(", "),
 allowed_risk_grades: product.allowed_risk_grades.filter((g) => RISK_TOGGLE.includes(g)),
 is_active: product.is_active,
 });

 const validateForm = (form: CreateForm) => {
 if (!form.name.trim()) return "Name is required.";
 if (!form.code.trim()) return "Product code is required.";
 const minA = Number(form.min_amount);
 const maxA = Number(form.max_amount);
 if (!Number.isFinite(minA) || !Number.isFinite(maxA) || minA < 0 || maxA < minA) {
 return "Enter valid min/max amounts (max ≥ min).";
 }
 const minT = Number(form.min_term_days);
 const maxT = Number(form.max_term_days);
 if (!Number.isFinite(minT) || !Number.isFinite(maxT) || minT < 0 || maxT < minT) {
 return "Enter valid term bounds (max ≥ min).";
 }
 if (form.allowed_risk_grades.filter((g) => RISK_TOGGLE.includes(g)).length === 0) {
 return "Select at least one risk grade (A–D).";
 }
 return "";
 };

 const formToApiBody = (form: CreateForm) => {
 const raw: Record<string, unknown> = {
 name: form.name.trim(),
 code: form.code.trim(),
 min_amount: Number(form.min_amount),
 max_amount: Number(form.max_amount),
 min_term_days: Number(form.min_term_days),
 max_term_days: Number(form.max_term_days),
 interest_type: form.interest_type,
 interest_rate_per_month: Number(form.interest_rate_per_month),
 processing_fee_percent: Number(form.processing_fee_percent),
 insurance_fee_percent: Number(form.insurance_fee_percent),
 repayment_frequency: form.repayment_frequency,
 grace_period_days: Number(form.grace_period_days),
 required_documents_csv: form.required_documents_csv,
 allowed_risk_grades: form.allowed_risk_grades.filter((g) => RISK_TOGGLE.includes(g)),
 is_active: form.is_active,
 };
 return buildProductCreateApiBody(raw);
 };

 const handleCreateSubmit = async (e: FormEvent) => {
 e.preventDefault();
 setCreateError("");
 const msg = validateForm(createForm);
 if (msg) {
 setCreateError(msg);
 return;
 }
 setCreateSaving(true);
 try {
 const r = await fetch("/api/falco/products", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(formToApiBody(createForm)),
 });
 const json = await r.json().catch(() => ({}));
 if (!r.ok) {
 if (r.status === 401) {
 router.replace("/login");
 return;
 }
 const nested =
 typeof json.error === "object" && json.error !== null
 ? (json.error as { message?: string; details?: { field?: string; message?: string }[] })
 : null;
 const base =
 typeof json.message === "string"
 ? json.message
 : nested?.message ?? `Create failed (${r.status})`;
 const detailStr = formatValidationDetails(json.details ?? nested?.details);
 setCreateError(detailStr ? `${base} ${detailStr}` : base);
 return;
 }
 void loadProducts();
 setCreateOpen(false);
 setCreateForm(defaultCreateForm);
 } catch {
 setCreateError("Network error");
 } finally {
 setCreateSaving(false);
 }
 };

 const openEdit = (product: LoanProduct) => {
 setEditError("");
 setEditingProduct(product);
 setEditForm(productToForm(product));
 };

 const handleEditSubmit = async (e: FormEvent) => {
 e.preventDefault();
 if (!editingProduct) return;
 setEditError("");
 const msg = validateForm(editForm);
 if (msg) {
 setEditError(msg);
 return;
 }
 setEditSaving(true);
 try {
 const r = await fetch(`/api/falco/products/${encodeURIComponent(editingProduct.id)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(formToApiBody(editForm)),
 });
 const json = await r.json().catch(() => ({}));
 if (!r.ok) {
 if (r.status === 401) {
 router.replace("/login");
 return;
 }
 const nested =
 typeof json.error === "object" && json.error !== null
 ? (json.error as { message?: string; details?: { field?: string; message?: string }[] })
 : null;
 const base =
 typeof json.message === "string"
 ? json.message
 : nested?.message ?? `Update failed (${r.status})`;
 const detailStr = formatValidationDetails(json.details ?? nested?.details);
 setEditError(detailStr ? `${base} ${detailStr}` : base);
 return;
 }
 void loadProducts();
 setEditingProduct(null);
 setEditForm(defaultCreateForm);
 } catch {
 setEditError("Network error");
 } finally {
 setEditSaving(false);
 }
 };

 const monthlyDisplay = (p: LoanProduct) =>
 p.interest_rate_per_month != null
 ? `${p.interest_rate_per_month.toFixed(2)}% / month`
 : `${(p.interest_rate / 12).toFixed(2)}% / month (est.)`;

 return (
 <>
 <DashboardHeader
 title="Loan Products"
 description="Manage loan products, limits, fees, and required documents."
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-6xl space-y-6">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="relative max-w-sm flex-1">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search products..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
 />
 </div>
 <div className="flex flex-wrap items-center gap-3">
 <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
 <Switch id="inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
 <Label htmlFor="inactive" className="cursor-pointer text-sm">
 Show inactive
 </Label>
 </div>
 <Button type="button" onClick={() => { setCreateError(""); setCreateForm(defaultCreateForm); setCreateOpen(true); }}>
 <Plus className="mr-2 h-4 w-4" />
 New product
 </Button>
 </div>
 </div>

 {listError ? (
 <p className="text-sm text-destructive">{listError}</p>
 ) : loading ? (
 <p className="text-sm text-muted-foreground flex items-center gap-2">
 <Loader2 className="h-4 w-4 animate-spin" />
 Loading products…
 </p>
 ) : filteredProducts.length === 0 ? (
 <p className="text-sm text-muted-foreground">No products in this view. Create one with New product.</p>
 ) : (
 <div className="grid gap-6 md:grid-cols-2">
 {filteredProducts.map((product) => (
 <Card key={product.id} className={!product.is_active ? "opacity-60" : ""}>
 <CardHeader>
 <div className="flex items-start justify-between">
 <div>
 <CardTitle className="flex flex-wrap items-center gap-2">
 {product.name}
 {product.is_active ? (
 <Badge variant="default" className="text-xs">
 Active
 </Badge>
 ) : (
 <Badge variant="secondary" className="text-xs">
 Inactive
 </Badge>
 )}
 </CardTitle>
 <CardDescription className="mt-1">
 {product.code}
 {product.description ? ` · ${product.description}` : ""}
 </CardDescription>
 </div>
 <Button variant="ghost" size="icon" type="button" title="Edit product" onClick={() => openEdit(product)}>
 <Edit className="h-4 w-4" />
 </Button>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground flex items-center gap-1">
 <Wallet className="h-3 w-3" />
 Loan amount range
 </p>
 <p className="text-sm font-medium">
 {formatCurrency(product.min_amount)} – {formatCurrency(product.max_amount)}
 </p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground flex items-center gap-1">
 <Calendar className="h-3 w-3" />
 Term range
 </p>
 <p className="text-sm font-medium">
 {product.min_term_days} – {product.max_term_days} days
 </p>
 </div>
 </div>

 <Separator />

 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground flex items-center gap-1">
 <Percent className="h-3 w-3" />
 Interest
 </p>
 <p className="text-lg font-bold text-primary">{monthlyDisplay(product)}</p>
 <p className="text-xs text-muted-foreground capitalize">{product.interest_type.replace("_", " ")}</p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground">Processing fee</p>
 <p className="text-sm font-medium">{product.processing_fee_percent}%</p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground">Insurance fee</p>
 <p className="text-sm font-medium">{product.insurance_fee_percent}%</p>
 </div>
 </div>

 <Separator />

 <div>
 <p className="text-xs text-muted-foreground mb-2">Eligible risk grades</p>
 <div className="flex flex-wrap gap-1">
 {(["A", "B", "C", "D", "E"] as const).map((grade) => (
 <Badge
 key={grade}
 variant={product.allowed_risk_grades.includes(grade) ? "default" : "outline"}
 className="text-xs"
 >
 {grade}
 </Badge>
 ))}
 </div>
 </div>

 <div>
 <p className="text-xs text-muted-foreground mb-2">Required documents</p>
 <div className="flex flex-wrap gap-1">
 {product.required_documents.length === 0 ? (
 <span className="text-xs text-muted-foreground">None specified</span>
 ) : (
 product.required_documents.map((doc) => (
 <Badge key={doc} variant="secondary" className="text-xs">
 {doc}
 </Badge>
 ))
 )}
 </div>
 </div>

 <Separator />

 <p className="text-xs text-muted-foreground rounded-lg bg-muted p-3">
 Product usage appears here when loan activity is available.
 </p>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <Dialog open={createOpen} onOpenChange={setCreateOpen}>
 <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
 <DialogHeader>
 <DialogTitle>New loan product</DialogTitle>
 <DialogDescription>
 Set the product rules officers will use when creating loan applications.
 </DialogDescription>
 </DialogHeader>
 <form onSubmit={handleCreateSubmit} className="space-y-4">
 {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="p-name">Name</Label>
 <Input
 id="p-name"
 value={createForm.name}
 onChange={(e) => updateCreate("name", e.target.value)}
 placeholder="e.g. Micro Business 30"
 />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="p-code">Code</Label>
 <Input
 id="p-code"
 value={createForm.code}
 onChange={(e) => updateCreate("code", e.target.value)}
 placeholder="e.g. MICRO-30 (stored uppercase)"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="p-min-a">Min amount (TZS)</Label>
 <Input
 id="p-min-a"
 type="number"
 min={0}
 value={createForm.min_amount}
 onChange={(e) => updateCreate("min_amount", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="p-max-a">Max amount (TZS)</Label>
 <Input
 id="p-max-a"
 type="number"
 min={0}
 value={createForm.max_amount}
 onChange={(e) => updateCreate("max_amount", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="p-min-t">Min term (days)</Label>
 <Input
 id="p-min-t"
 type="number"
 min={0}
 value={createForm.min_term_days}
 onChange={(e) => updateCreate("min_term_days", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="p-max-t">Max term (days)</Label>
 <Input
 id="p-max-t"
 type="number"
 min={0}
 value={createForm.max_term_days}
 onChange={(e) => updateCreate("max_term_days", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label>Interest type</Label>
 <Select
 value={createForm.interest_type}
 onValueChange={(v) => updateCreate("interest_type", v as CreateForm["interest_type"])}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="flat">Flat</SelectItem>
 <SelectItem value="reducing_balance">Reducing balance</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="p-ir">Interest % per month</Label>
 <Input
 id="p-ir"
 type="number"
 min={0}
 max={100}
 step="0.01"
 value={createForm.interest_rate_per_month}
 onChange={(e) => updateCreate("interest_rate_per_month", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="p-proc">Processing fee %</Label>
 <Input
 id="p-proc"
 type="number"
 min={0}
 max={100}
 step="0.01"
 value={createForm.processing_fee_percent}
 onChange={(e) => updateCreate("processing_fee_percent", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="p-ins">Insurance fee %</Label>
 <Input
 id="p-ins"
 type="number"
 min={0}
 max={100}
 step="0.01"
 value={createForm.insurance_fee_percent}
 onChange={(e) => updateCreate("insurance_fee_percent", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label>Repayment frequency</Label>
 <Select
 value={createForm.repayment_frequency}
 onValueChange={(v) => updateCreate("repayment_frequency", v as CreateForm["repayment_frequency"])}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="daily">Daily</SelectItem>
 <SelectItem value="weekly">Weekly</SelectItem>
 <SelectItem value="bi_weekly">Bi-weekly</SelectItem>
 <SelectItem value="monthly">Monthly</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="p-grace">Grace period (days)</Label>
 <Input
 id="p-grace"
 type="number"
 min={0}
 value={createForm.grace_period_days}
 onChange={(e) => updateCreate("grace_period_days", e.target.value)}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="p-docs">Required documents</Label>
 <Textarea
 id="p-docs"
 rows={2}
 value={createForm.required_documents_csv}
 onChange={(e) => updateCreate("required_documents_csv", e.target.value)}
 placeholder="Comma-separated slugs: national_id, business_license"
 />
 </div>

 <div className="space-y-2">
 <Label>Allowed risk grades</Label>
 <div className="flex flex-wrap gap-3">
 {RISK_TOGGLE.map((g) => (
 <label key={g} className="flex items-center gap-2 text-sm">
 <Checkbox checked={createForm.allowed_risk_grades.includes(g)} onCheckedChange={() => toggleRisk(g)} />
 {g}
 </label>
 ))}
 </div>
 </div>

 <div className="flex items-center gap-2">
 <Checkbox
 id="p-active"
 checked={createForm.is_active}
 onCheckedChange={(c) => updateCreate("is_active", c === true)}
 />
 <Label htmlFor="p-active" className="cursor-pointer font-normal">
 Product active
 </Label>
 </div>

 <DialogFooter className="gap-2 sm:gap-0">
 <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createSaving}>
 Cancel
 </Button>
 <Button type="submit" disabled={createSaving}>
 {createSaving ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Saving…
 </>
 ) : (
 "Create product"
 )}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>

 <Dialog open={Boolean(editingProduct)} onOpenChange={(open) => !open && setEditingProduct(null)}>
 <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Edit loan product</DialogTitle>
 <DialogDescription>Update the product rules officers use when creating loan applications.</DialogDescription>
 </DialogHeader>
 <form onSubmit={handleEditSubmit} className="space-y-4">
 {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="edit-p-name">Name</Label>
 <Input
 id="edit-p-name"
 value={editForm.name}
 onChange={(e) => updateEdit("name", e.target.value)}
 placeholder="e.g. Micro Business 30"
 />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="edit-p-code">Code</Label>
 <Input
 id="edit-p-code"
 value={editForm.code}
 onChange={(e) => updateEdit("code", e.target.value)}
 placeholder="e.g. MICRO-30"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-p-min-a">Min amount (TZS)</Label>
 <Input
 id="edit-p-min-a"
 type="number"
 min={0}
 value={editForm.min_amount}
 onChange={(e) => updateEdit("min_amount", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-p-max-a">Max amount (TZS)</Label>
 <Input
 id="edit-p-max-a"
 type="number"
 min={0}
 value={editForm.max_amount}
 onChange={(e) => updateEdit("max_amount", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-p-min-t">Min term (days)</Label>
 <Input
 id="edit-p-min-t"
 type="number"
 min={0}
 value={editForm.min_term_days}
 onChange={(e) => updateEdit("min_term_days", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-p-max-t">Max term (days)</Label>
 <Input
 id="edit-p-max-t"
 type="number"
 min={0}
 value={editForm.max_term_days}
 onChange={(e) => updateEdit("max_term_days", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label>Interest type</Label>
 <Select
 value={editForm.interest_type}
 onValueChange={(v) => updateEdit("interest_type", v as CreateForm["interest_type"])}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="flat">Flat</SelectItem>
 <SelectItem value="reducing_balance">Reducing balance</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-p-ir">Interest % per month</Label>
 <Input
 id="edit-p-ir"
 type="number"
 min={0}
 max={100}
 step="0.01"
 value={editForm.interest_rate_per_month}
 onChange={(e) => updateEdit("interest_rate_per_month", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-p-proc">Processing fee %</Label>
 <Input
 id="edit-p-proc"
 type="number"
 min={0}
 max={100}
 step="0.01"
 value={editForm.processing_fee_percent}
 onChange={(e) => updateEdit("processing_fee_percent", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-p-ins">Insurance fee %</Label>
 <Input
 id="edit-p-ins"
 type="number"
 min={0}
 max={100}
 step="0.01"
 value={editForm.insurance_fee_percent}
 onChange={(e) => updateEdit("insurance_fee_percent", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label>Repayment frequency</Label>
 <Select
 value={editForm.repayment_frequency}
 onValueChange={(v) => updateEdit("repayment_frequency", v as CreateForm["repayment_frequency"])}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="daily">Daily</SelectItem>
 <SelectItem value="weekly">Weekly</SelectItem>
 <SelectItem value="bi_weekly">Bi-weekly</SelectItem>
 <SelectItem value="monthly">Monthly</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-p-grace">Grace period (days)</Label>
 <Input
 id="edit-p-grace"
 type="number"
 min={0}
 value={editForm.grace_period_days}
 onChange={(e) => updateEdit("grace_period_days", e.target.value)}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="edit-p-docs">Required documents</Label>
 <Textarea
 id="edit-p-docs"
 rows={2}
 value={editForm.required_documents_csv}
 onChange={(e) => updateEdit("required_documents_csv", e.target.value)}
 placeholder="Comma-separated slugs: national_id, business_license"
 />
 </div>

 <div className="space-y-2">
 <Label>Allowed risk grades</Label>
 <div className="flex flex-wrap gap-3">
 {RISK_TOGGLE.map((g) => (
 <label key={g} className="flex items-center gap-2 text-sm">
 <Checkbox checked={editForm.allowed_risk_grades.includes(g)} onCheckedChange={() => toggleEditRisk(g)} />
 {g}
 </label>
 ))}
 </div>
 </div>

 <div className="flex items-center gap-2">
 <Checkbox
 id="edit-p-active"
 checked={editForm.is_active}
 onCheckedChange={(c) => updateEdit("is_active", c === true)}
 />
 <Label htmlFor="edit-p-active" className="cursor-pointer font-normal">
 Product active
 </Label>
 </div>

 <DialogFooter className="gap-2 sm:gap-0">
 <Button type="button" variant="outline" onClick={() => setEditingProduct(null)} disabled={editSaving}>
 Cancel
 </Button>
 <Button type="submit" disabled={editSaving}>
 {editSaving ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Saving…
 </>
 ) : (
 "Save changes"
 )}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 </div>
 </main>
 </>
 );
}
