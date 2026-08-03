"use client";

import { useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APPLICATION_REJECTION_CODES } from "@/lib/application-rejection-codes";

export type RejectApplicationDialogProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 /** Optional label of the application being rejected, shown in the dialog copy. */
 subjectLabel?: string;
 onConfirm: (details: { rejection_code: string; rejection_reason?: string }) => Promise<{
 ok: boolean;
 error?: string;
 }>;
};

/**
 * Shared reject dialog for loan applications. Requires a `rejection_code`; when the
 * selected code is "other", also requires a free-text `rejection_reason`.
 */
export function RejectApplicationDialog({
 open,
 onOpenChange,
 subjectLabel,
 onConfirm,
}: RejectApplicationDialogProps) {
 const [code, setCode] = useState("");
 const [reason, setReason] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState("");

 useEffect(() => {
 if (!open) {
 setCode("");
 setReason("");
 setError("");
 setSubmitting(false);
 }
 }, [open]);

 const requiresReason = code === "other";
 const canSubmit = Boolean(code) && (!requiresReason || reason.trim().length > 0);

 const handleConfirm = async () => {
 if (!canSubmit) return;
 setSubmitting(true);
 setError("");
 try {
 const result = await onConfirm({
 rejection_code: code,
 rejection_reason: reason.trim() || undefined,
 });
 if (!result.ok) {
 setError(result.error || "Could not reject this application.");
 return;
 }
 onOpenChange(false);
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
 <DialogTitle className="flex items-center gap-2 text-destructive">
 <XCircle className="h-5 w-5 shrink-0" />
 Reject application
 </DialogTitle>
 <DialogDescription>
 {subjectLabel ? (
 <>
 Rejecting <span className="font-medium text-foreground">{subjectLabel}</span>. Select a
 reason — this is sent to the backend and shown to the applicant.
 </>
 ) : (
 "Select a reason for rejecting this application."
 )}
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-1">
 <div className="space-y-2">
 <Label htmlFor="rejection-code">Rejection reason</Label>
 <Select value={code} onValueChange={setCode} disabled={submitting}>
 <SelectTrigger id="rejection-code" className="w-full">
 <SelectValue placeholder="Select a reason" />
 </SelectTrigger>
 <SelectContent>
 {APPLICATION_REJECTION_CODES.map((c) => (
 <SelectItem key={c.value} value={c.value}>
 {c.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="rejection-reason">
 Additional details{requiresReason ? "" : " (optional)"}
 </Label>
 <Textarea
 id="rejection-reason"
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 placeholder={
 requiresReason
 ? "Describe the reason for rejection…"
 : "Optional notes for the applicant or file…"
 }
 disabled={submitting}
 rows={3}
 />
 </div>

 {error ? <p className="text-sm text-destructive">{error}</p> : null}
 </div>

 <DialogFooter>
 <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
 Cancel
 </Button>
 <Button type="button" variant="destructive" disabled={!canSubmit || submitting} onClick={() => void handleConfirm()}>
 {submitting ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Rejecting…
 </>
 ) : (
 <>
 <XCircle className="mr-2 h-4 w-4" />
 Reject application
 </>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
