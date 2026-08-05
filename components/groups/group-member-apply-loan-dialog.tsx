"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatApiResponseError } from "@/lib/falco-api";
import { formatCurrency } from "@/lib/formatters";
import { parseMoneyInput } from "@/lib/money-input";
import { extractProductsList } from "@/lib/product-adapters";
import { validateApplicationAgainstProduct } from "@/lib/application-payload";
import { resolvePortalHref } from "@/lib/portal-paths";
import type { LoanProduct, UserRole } from "@/lib/types";

export type GroupMemberApplyTarget = {
  customerId: string;
  customerName: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  member: GroupMemberApplyTarget | null;
  role?: UserRole | null;
};

export function GroupMemberApplyLoanDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  member,
  role,
}: Props) {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [termDays, setTermDays] = useState("");
  const [purpose, setPurpose] = useState("Business capital");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedProduct = products.find((p) => p.id === productId) ?? null;

  const resetForm = useCallback(() => {
    setProductId("");
    setAmount("");
    setTermDays("");
    setPurpose("Business capital");
    setError("");
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    let cancelled = false;
    setProductsLoading(true);
    setProductsError("");
    void fetch("/api/falco/products?is_active=true", { credentials: "include" })
      .then(async (res) => {
        const json = (await res.json()) as { message?: string; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setProducts([]);
          setProductsError(json.message ?? json.error ?? "Could not load loan products");
          return;
        }
        const list = extractProductsList(json);
        setProducts(list);
        if (!list.length) {
          setProductsError("No active loan products found.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setProductsError("Could not load loan products.");
        }
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, resetForm]);

  useEffect(() => {
    if (!selectedProduct) return;
    setTermDays((prev) => {
      if (prev.trim()) return prev;
      return String(selectedProduct.min_term_days || 90);
    });
  }, [selectedProduct]);

  const handleSubmit = async () => {
    if (!member) return;
    setError("");

    if (!productId || !selectedProduct) {
      setError("Select a loan product.");
      return;
    }

    const requestedAmount = parseMoneyInput(amount);
    const term = Number(termDays);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      setError("Enter a valid requested amount.");
      return;
    }
    if (!Number.isFinite(term) || term <= 0) {
      setError("Enter a valid term in days.");
      return;
    }

    const productError = validateApplicationAgainstProduct(
      requestedAmount,
      term,
      selectedProduct
    );
    if (productError) {
      setError(productError);
      return;
    }

    const purposeText = purpose.trim() || "Business capital";

    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: member.customerId,
          group_id: groupId,
          product_id: productId,
          loan_mode: "individual",
          requested_amount: requestedAmount,
          term_days: term,
          purpose: purposeText,
          repayment_frequency: selectedProduct.repayment_frequency || "weekly",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
        application?: { id?: string };
        id?: string;
      };
      if (!res.ok) {
        setError(formatApiResponseError(json, "Could not create loan application"));
        return;
      }

      const createdId = String(json.application?.id ?? json.id ?? "").trim();
      const appHref = createdId
        ? resolvePortalHref(role ?? undefined, `/applications/${createdId}`)
        : resolvePortalHref(role ?? undefined, "/applications");

      toast.success(`Loan application created for ${member.customerName}`, {
        action: {
          label: "Open",
          onClick: () => {
            window.location.href = appHref;
          },
        },
      });
      onOpenChange(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for loan</DialogTitle>
          <DialogDescription>
            Create an individual application for{" "}
            <span className="font-medium text-foreground">{member?.customerName ?? "this member"}</span>{" "}
            in <span className="font-medium text-foreground">{groupName}</span>. Each member uses
            their own requested amount.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="member-loan-product">Loan product</Label>
            <Select
              value={productId}
              onValueChange={setProductId}
              disabled={productsLoading || submitting}
            >
              <SelectTrigger id="member-loan-product" className="w-full">
                <SelectValue
                  placeholder={productsLoading ? "Loading products…" : "Select product"}
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
            {productsError ? <p className="text-xs text-destructive">{productsError}</p> : null}
            {selectedProduct ? (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(selectedProduct.min_amount)} –{" "}
                {formatCurrency(selectedProduct.max_amount)} · {selectedProduct.min_term_days}–
                {selectedProduct.max_term_days} days
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-loan-amount">Requested amount (TZS)</Label>
            <MoneyInput
              id="member-loan-amount"
              placeholder="e.g. 250,000"
              value={amount}
              onValueChange={setAmount}
              disabled={!selectedProduct || submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-loan-term">Term (days)</Label>
            <Input
              id="member-loan-term"
              type="number"
              min={1}
              placeholder="e.g. 90"
              value={termDays}
              onChange={(e) => setTermDays(e.target.value)}
              disabled={!selectedProduct || submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-loan-purpose">Purpose</Label>
            <Textarea
              id="member-loan-purpose"
              rows={2}
              placeholder="Business capital"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={submitting || !member} onClick={() => void handleSubmit()}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create application"
            )}
          </Button>
        </DialogFooter>

        <p className="text-xs text-muted-foreground">
          After create you can add documents and submit from{" "}
          <Link href={resolvePortalHref(role ?? undefined, "/applications")} className="underline">
            Applications
          </Link>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
