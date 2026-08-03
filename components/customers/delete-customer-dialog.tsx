"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2, UserX } from "lucide-react";
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
 onDeleted: (opts?: { softOnly?: boolean; backendMessage?: string; deactivated?: boolean }) => void;
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
 const [deactivating, setDeactivating] = useState(false);
 const [error, setError] = useState("");
 /** Set when the backend returns 409 for DELETE because the customer has operational history. */
 const [blockedByHistory, setBlockedByHistory] = useState(false);

 useEffect(() => {
 if (!open) {
 setStep(1);
 setConfirmText("");
 setError("");
 setDeleting(false);
 setDeactivating(false);
 setBlockedByHistory(false);
 }
 }, [open]);

 const fullName = customer
 ? [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(" ")
 : "";

 const canConfirmDelete =
 Boolean(customer) && confirmText.trim() === customer?.customer_number.trim();

 const handleDelete = async () => {
 if (!customer || !canConfirmDelete) return;
 setDeleting(true);
 setError("");
 setBlockedByHistory(false);
 try {
 const res = await fetch(`/api/customers/${encodeURIComponent(customer.id)}`, {
 method: "DELETE",
 credentials: "include",
 });
 if (res.status === 204) {
 onOpenChange(false);
 onDeleted({ softOnly: false });
 return;
 }
 const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
 if (res.status === 409) {
 // Backend rule: customers with loan-application/group-membership history cannot be
 // hard-deleted. Offer Deactivate instead rather than silently soft-hiding.
 setBlockedByHistory(true);
 setError(
 json.message ??
 json.error ??
 "This customer cannot be deleted because they have loan application or group history. You can deactivate them instead."
 );
 return;
 }
 // Unexpected error (network/5xx): fall back to hiding locally for this operator only.
 onOpenChange(false);
 onDeleted({
 softOnly: true,
 backendMessage: json.message ?? json.error ?? "Could not delete customer on backend",
 });
 } catch {
 onOpenChange(false);
 onDeleted({
 softOnly: true,
 backendMessage: "Network error while contacting backend. Customer hidden from list locally.",
 });
 } finally {
 setDeleting(false);
 }
 };

 const handleDeactivate = async () => {
 if (!customer) return;
 setDeactivating(true);
 setError("");
 try {
 const res = await fetch(`/api/customers/${encodeURIComponent(customer.id)}/deactivate`, {
 method: "POST",
 credentials: "include",
 });
 const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
 if (!res.ok) {
 if (res.status === 409) {
 setError(
 json.message ??
 json.error ??
 "This customer cannot be deactivated because they are linked to loan applications."
 );
 return;
 }
 onOpenChange(false);
 onDeleted({
 softOnly: true,
 backendMessage: json.message ?? json.error ?? "Could not deactivate customer on backend",
 });
 return;
 }
 onOpenChange(false);
 onDeleted({ softOnly: false, deactivated: true });
 } catch {
 onOpenChange(false);
 onDeleted({
 softOnly: true,
 backendMessage: "Network error while contacting backend. Customer hidden from list locally.",
 });
 } finally {
 setDeactivating(false);
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
 disabled={deleting || deactivating}
 onClick={() => {
 setStep(1);
 setConfirmText("");
 setError("");
 setBlockedByHistory(false);
 }}
 >
 Back
 </Button>
 <AlertDialogCancel disabled={deleting || deactivating}>Cancel</AlertDialogCancel>
 {blockedByHistory ? (
 <Button
 type="button"
 variant="secondary"
 disabled={deactivating}
 onClick={() => void handleDeactivate()}
 >
 {deactivating ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Deactivating…
 </>
 ) : (
 <>
 <UserX className="mr-2 h-4 w-4" />
 Deactivate instead
 </>
 )}
 </Button>
 ) : (
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
 )}
 </AlertDialogFooter>
 </>
 )}
 </AlertDialogContent>
 </AlertDialog>
 );
}
