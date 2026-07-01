"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import type { StaffProvisioningRequest } from "@/lib/staff-requests-types";
import {
 extractProvisioningApproveResult,
 type ProvisioningApproveResult,
} from "@/lib/staff-provisioning-adapters";
import { roleLabel } from "@/components/staff-management/utils";
import type { StaffRole } from "@/components/staff-management/types";

type Props = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 request: StaffProvisioningRequest | null;
 branchName: string;
 onResolved: (result?: ProvisioningApproveResult) => void;
};

export function ApproveHireDialog({ open, onOpenChange, request, branchName, onResolved }: Props) {
 const [notes, setNotes] = useState("");
 const [temporaryPassword, setTemporaryPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 const [approvedResult, setApprovedResult] = useState<ProvisioningApproveResult | null>(null);

 useEffect(() => {
 if (!open) return;
 setNotes("");
 setTemporaryPassword("");
 setConfirmPassword("");
 setError("");
 setApprovedResult(null);
 }, [open, request?.id]);

 if (!request) return null;

 const close = () => onOpenChange(false);

 const copyPassword = async (value: string) => {
 try {
 await navigator.clipboard.writeText(value);
 toast.success("Password copied to clipboard");
 } catch {
 toast.error("Could not copy password");
 }
 };

 const handleReject = async () => {
 setSaving(true);
 setError("");
 try {
 const res = await fetch(`/api/staff/provisioning/${encodeURIComponent(request.id)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ status: "rejected", notes: notes.trim() || null }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setError(typeof data.error === "string" ? data.error : "Could not reject request");
 return;
 }
 toast.message("Hire request rejected");
 onResolved();
 close();
 } finally {
 setSaving(false);
 }
 };

 const handleApprove = async () => {
 const pwd = temporaryPassword.trim();
 const confirm = confirmPassword.trim();
 if (pwd && pwd.length < 8) {
 setError("Portal password must be at least 8 characters.");
 return;
 }
 if (pwd && pwd !== confirm) {
 setError("Password confirmation does not match.");
 return;
 }

 setSaving(true);
 setError("");
 try {
 const res = await fetch(`/api/staff/provisioning/${encodeURIComponent(request.id)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 status: "approved",
 notes: notes.trim() || null,
 temporary_password: pwd || undefined,
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setError(typeof data.error === "string" ? data.error : "Could not approve request");
 return;
 }

 const parsed = extractProvisioningApproveResult(data);
 const normalized: ProvisioningApproveResult = parsed ?? {
 request,
 temporaryPassword:
 typeof (data as { temporary_password?: string }).temporary_password === "string"
 ? (data as { temporary_password: string }).temporary_password
 : undefined,
 };

 setApprovedResult(normalized);
 onResolved(normalized);
 toast.success(`${request.full_name} is now active in the team directory`);
 } finally {
 setSaving(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>{approvedResult ? "Hire approved" : "Approve hire request"}</DialogTitle>
 <DialogDescription>
 {approvedResult
 ? "Share the portal password securely with the new team member. They can sign in immediately."
 : `Create portal access for ${request.full_name} at ${branchName}.`}
 </DialogDescription>
 </DialogHeader>

 {!approvedResult ? (
 <div className="space-y-4 py-2">
 <div className="rounded-lg border bg-muted/30 p-3 text-sm">
 <p className="font-medium">{request.full_name}</p>
 <p className="text-muted-foreground">{request.email}</p>
 <p className="text-muted-foreground">
 {roleLabel(request.role as StaffRole)} · {branchName}
 </p>
 </div>
 <div className="space-y-2">
 <Label htmlFor="hire-password">Portal password (optional)</Label>
 <Input
 id="hire-password"
 type="password"
 autoComplete="new-password"
 value={temporaryPassword}
 onChange={(e) => setTemporaryPassword(e.target.value)}
 placeholder="Leave blank to generate a password"
 />
 <p className="text-xs text-muted-foreground">
 If empty, a temporary password may be created after approval.
 </p>
 </div>
 {temporaryPassword ? (
 <div className="space-y-2">
 <Label htmlFor="hire-password-confirm">Confirm password</Label>
 <Input
 id="hire-password-confirm"
 type="password"
 autoComplete="new-password"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 />
 </div>
 ) : null}
 <div className="space-y-2">
 <Label htmlFor="hire-notes">Review notes (optional)</Label>
 <Textarea
 id="hire-notes"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={2}
 placeholder="Internal note for audit trail"
 />
 </div>
 {error ? <p className="text-sm text-destructive">{error}</p> : null}
 </div>
 ) : (
 <div className="space-y-4 py-2">
 <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm">
 <p className="font-medium text-emerald-900">{request.full_name} added to office team</p>
 {approvedResult.employeeId ? (
 <p className="mt-1 text-emerald-800">Employee ID: {approvedResult.employeeId}</p>
 ) : null}
 <p className="mt-1 text-emerald-800">Email: {request.email}</p>
 </div>
 {approvedResult.temporaryPassword ? (
 <div className="space-y-2 rounded-lg border p-3">
 <p className="flex items-center gap-2 text-sm font-medium">
 <KeyRound className="h-4 w-4" />
 Portal login password
 </p>
 <div className="flex gap-2">
 <Input readOnly value={approvedResult.temporaryPassword} className="font-mono" />
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => void copyPassword(approvedResult.temporaryPassword!)}
 aria-label="Copy password"
 >
 <Copy className="h-4 w-4" />
 </Button>
 </div>
 <p className="text-xs text-muted-foreground">
 The officer should change this password after first login.
 </p>
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">
 Account created. Use Staff Management → Directory → Reset password if you need to set login credentials.
 </p>
 )}
 </div>
 )}

 <DialogFooter className="gap-2 sm:gap-0">
 {!approvedResult ? (
 <>
 <Button type="button" variant="outline" onClick={() => void handleReject()} disabled={saving}>
 Reject
 </Button>
 <Button type="button" onClick={() => void handleApprove()} disabled={saving}>
 {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
 Approve & create account
 </Button>
 </>
 ) : (
 <Button type="button" onClick={close}>
 Done
 </Button>
 )}
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
