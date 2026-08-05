"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
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
import { deleteApplicationApi } from "@/lib/application-workflow";

export type DeleteApplicationTarget = {
 id: string;
 application_number: string;
 customerDisplayName?: string;
};

type Props = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 application: DeleteApplicationTarget | null;
 onDeleted: () => void;
};

export function DeleteApplicationDialog({ open, onOpenChange, application, onDeleted }: Props) {
 const [step, setStep] = useState<1 | 2>(1);
 const [confirmText, setConfirmText] = useState("");
 const [error, setError] = useState("");
 const [deleting, setDeleting] = useState(false);

 const confirmToken = useMemo(
 () => (application?.application_number ?? "").trim(),
 [application?.application_number]
 );

 const confirmMatches =
 confirmToken.length > 0 && confirmText.trim().toUpperCase() === confirmToken.toUpperCase();

 useEffect(() => {
 if (!open) {
 setStep(1);
 setConfirmText("");
 setError("");
 setDeleting(false);
 }
 }, [open]);

 const handleClose = (next: boolean) => {
 if (deleting) return;
 onOpenChange(next);
 };

 const handleDelete = async () => {
 if (!application || !confirmMatches) return;
 setDeleting(true);
 setError("");
 const result = await deleteApplicationApi(application.id);
 setDeleting(false);
 if (!result.ok) {
 setError(result.error);
 return;
 }
 onDeleted();
 handleClose(false);
 };

 return (
 <Dialog open={open} onOpenChange={handleClose}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-destructive">
 <Trash2 className="h-5 w-5" />
 Delete loan application
 </DialogTitle>
 <DialogDescription>
 {application
 ? step === 1
 ? `You are about to permanently delete ${application.application_number}${
 application.customerDisplayName ? ` (${application.customerDisplayName})` : ""
 }. This removes the application and cannot be undone.`
 : `Type ${confirmToken} below to confirm permanent deletion.`
 : "Select an application to delete."}
 </DialogDescription>
 </DialogHeader>

 {application && step === 1 ? (
 <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
 <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
 <p>
 Linked documents and workflow history for this application will be removed. Active disbursed
 loans cannot be deleted from here.
 </p>
 </div>
 ) : null}

 {application && step === 2 ? (
 <div className="space-y-2">
 <Label htmlFor="delete-confirm-app">Application number</Label>
 <Input
 id="delete-confirm-app"
 value={confirmText}
 onChange={(e) => setConfirmText(e.target.value)}
 placeholder={confirmToken}
 autoComplete="off"
 disabled={deleting}
 />
 <p className="text-xs text-muted-foreground">
 Enter <span className="font-mono font-medium">{confirmToken}</span> exactly (not case-sensitive).
 </p>
 </div>
 ) : null}

 {error ? <p className="text-sm text-destructive">{error}</p> : null}

 <DialogFooter className="gap-2 sm:gap-0">
 {step === 2 ? (
 <Button type="button" variant="outline" disabled={deleting} onClick={() => setStep(1)}>
 Back
 </Button>
 ) : (
 <Button type="button" variant="outline" disabled={deleting} onClick={() => handleClose(false)}>
 Cancel
 </Button>
 )}
 {step === 1 ? (
 <Button
 type="button"
 variant="destructive"
 disabled={!application || deleting}
 onClick={() => setStep(2)}
 >
 Continue
 </Button>
 ) : (
 <Button
 type="button"
 variant="destructive"
 disabled={!confirmMatches || deleting}
 onClick={() => void handleDelete()}
 >
 {deleting ? "Deleting…" : "Delete permanently"}
 </Button>
 )}
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
