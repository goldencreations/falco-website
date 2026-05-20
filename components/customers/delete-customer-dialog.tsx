"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
 AlertDialog,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Customer } from "@/lib/types";

type DeleteCustomerDialogProps = {
 customer: Customer | null;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onDeleted: () => void;
};

export function DeleteCustomerDialog({
 customer,
 open,
 onOpenChange,
 onDeleted,
}: DeleteCustomerDialogProps) {
 const [step, setStep] = useState<1 | 2>(1);
 const [confirmText, setConfirmText] = useState("");
 const [deleting, setDeleting] = useState(false);
 const [error, setError] = useState("");

 useEffect(() => {
 if (!open) {
 setStep(1);
 setConfirmText("");
 setError("");
 setDeleting(false);
 }
 }, [open]);

 const fullName = customer
 ? [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(" ")
 : "";

 const canConfirmDelete =
 Boolean(customer) && confirmText.trim() === customer.customer_number.trim();

 const handleDelete = async () => {
 if (!customer || !canConfirmDelete) return;
 setDeleting(true);
 setError("");
 try {
 const res = await fetch(`/api/customers/${encodeURIComponent(customer.id)}/deactivate`, {
 method: "POST",
 credentials: "include",
 });
 const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
 if (!res.ok) {
 setError(json.message ?? json.error ?? "Could not delete customer");
 return;
 }
 onOpenChange(false);
 onDeleted();
 } catch {
 setError("Network error. Please try again.");
 } finally {
 setDeleting(false);
 }
 };

 return (
 <AlertDialog
 open={open}
 onOpenChange={(next) => {
 if (!deleting) onOpenChange(next);
 }}
 >
 <AlertDialogContent className="sm:max-w-md">
 {step === 1 ? (
 <>
 <AlertDialogHeader>
 <AlertDialogTitle className="flex items-center gap-2 text-destructive">
 <AlertTriangle className="h-5 w-5 shrink-0" />
 Delete customer?
 </AlertDialogTitle>
 <AlertDialogDescription asChild>
 <div className="space-y-2 text-sm text-muted-foreground">
 <p>
 You are about to permanently remove this customer from the active registry. Loan
 history may remain in reports, but the customer will no longer appear in lists or new
 applications.
 </p>
 {customer ? (
 <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-foreground">
 <p className="font-medium">{fullName}</p>
 <p className="text-xs text-muted-foreground">{customer.customer_number}</p>
 <p className="text-xs text-muted-foreground">{customer.phone_primary}</p>
 </div>
 ) : null}
 <p className="font-medium text-foreground">This action cannot be undone from the app.</p>
 </div>
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
 <Button
 type="button"
 variant="destructive"
 disabled={!customer || deleting}
 onClick={() => setStep(2)}
 >
 Continue
 </Button>
 </AlertDialogFooter>
 </>
 ) : (
 <>
 <AlertDialogHeader>
 <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
 <AlertDialogDescription asChild>
 <div className="space-y-3 text-sm text-muted-foreground">
 <p>
 To confirm you intend to delete{" "}
 <span className="font-medium text-foreground">{fullName}</span>, type the customer
 number{" "}
 <span className="font-mono font-medium text-foreground">
 {customer?.customer_number}
 </span>{" "}
 below, then select delete.
 </p>
 </div>
 </AlertDialogDescription>
 </AlertDialogHeader>
 <div className="space-y-2 py-1">
 <Label htmlFor="delete-customer-confirm">Customer number</Label>
 <Input
 id="delete-customer-confirm"
 value={confirmText}
 onChange={(e) => setConfirmText(e.target.value)}
 placeholder={customer?.customer_number ?? ""}
 autoComplete="off"
 disabled={deleting}
 />
 {error ? <p className="text-sm text-destructive">{error}</p> : null}
 </div>
 <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
 <Button
 type="button"
 variant="outline"
 disabled={deleting}
 onClick={() => {
 setStep(1);
 setConfirmText("");
 setError("");
 }}
 >
 Back
 </Button>
 <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
 <Button
 type="button"
 variant="destructive"
 disabled={!canConfirmDelete || deleting}
 onClick={() => void handleDelete()}
 >
 {deleting ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Deleting…
 </>
 ) : (
 <>
 <Trash2 className="mr-2 h-4 w-4" />
 Delete customer
 </>
 )}
 </Button>
 </AlertDialogFooter>
 </>
 )}
 </AlertDialogContent>
 </AlertDialog>
 );
}
