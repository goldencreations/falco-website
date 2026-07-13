"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiResponseError } from "@/lib/falco-api";
import type { GroupDetailView } from "@/lib/group-adapters";

type Props = {
 group: GroupDetailView;
 groupsListHref: string;
};

export function GroupDeleteDangerZone({ group, groupsListHref }: Props) {
 const router = useRouter();
 const [dialogOpen, setDialogOpen] = useState(false);
 const [step, setStep] = useState<1 | 2>(1);
 const [confirmText, setConfirmText] = useState("");
 const [deleting, setDeleting] = useState(false);
 const [error, setError] = useState("");

 const confirmTarget = (group.group_code || group.id).trim();

 useEffect(() => {
 if (!dialogOpen) {
 setStep(1);
 setConfirmText("");
 setError("");
 setDeleting(false);
 }
 }, [dialogOpen]);

 const canConfirmDelete = confirmText.trim() === confirmTarget;

 const handleDelete = async () => {
 if (!canConfirmDelete) return;
 setDeleting(true);
 setError("");
 try {
 const res = await fetch(`/api/groups/${encodeURIComponent(group.id)}`, {
 method: "DELETE",
 credentials: "include",
 });
 if (!res.ok) {
 const json = (await res.json().catch(() => ({}))) as unknown;
 setError(formatApiResponseError(json, "Could not delete this vikundi"));
 return;
 }
 setDialogOpen(false);
 router.push(groupsListHref);
 router.refresh();
 } catch {
 setError("Network error. Please try again.");
 } finally {
 setDeleting(false);
 }
 };

 return (
 <>
 <Card className="border-destructive/30 bg-destructive/5">
 <CardHeader>
 <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
 <CardDescription>
 Permanently delete this vikundi. Member history and linked records may remain in reports,
 but the group will no longer appear in lists or new applications.
 </CardDescription>
 </CardHeader>
 <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="space-y-1 text-sm text-muted-foreground">
 <p>
 Delete <span className="font-medium text-foreground">{group.group_name}</span> (
 <span className="font-mono text-xs">{confirmTarget}</span>).
 </p>
 <p className="text-xs">This action cannot be undone.</p>
 </div>
 <Button type="button" variant="destructive" onClick={() => setDialogOpen(true)}>
 <Trash2 className="mr-2 h-4 w-4" />
 Delete vikundi
 </Button>
 </CardContent>
 </Card>

 <AlertDialog
 open={dialogOpen}
 onOpenChange={(next) => {
 if (!deleting) setDialogOpen(next);
 }}
 >
 <AlertDialogContent className="sm:max-w-md">
 {step === 1 ? (
 <>
 <AlertDialogHeader>
 <AlertDialogTitle className="flex items-center gap-2 text-destructive">
 <AlertTriangle className="h-5 w-5 shrink-0" />
 Delete vikundi?
 </AlertDialogTitle>
 <AlertDialogDescription asChild>
 <div className="space-y-2 text-sm text-muted-foreground">
 <p>
 You are about to permanently delete this vikundi and remove it from active group
 lending. Existing loan records tied to members may remain in the system.
 </p>
 <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-foreground">
 <p className="font-medium">{group.group_name}</p>
 <p className="font-mono text-xs text-muted-foreground">{confirmTarget}</p>
 <p className="text-xs text-muted-foreground">
 {group.members.length} member{group.members.length === 1 ? "" : "s"}
 </p>
 </div>
 <p className="font-medium text-foreground">This action cannot be undone.</p>
 </div>
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
 <Button type="button" variant="destructive" disabled={deleting} onClick={() => setStep(2)}>
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
 <span className="font-medium text-foreground">{group.group_name}</span>, type the group
 code{" "}
 <span className="font-mono font-medium text-foreground">{confirmTarget}</span> below,
 then select delete.
 </p>
 </div>
 </AlertDialogDescription>
 </AlertDialogHeader>
 <div className="space-y-2 py-1">
 <Label htmlFor="delete-group-confirm">Group code</Label>
 <Input
 id="delete-group-confirm"
 value={confirmText}
 onChange={(e) => setConfirmText(e.target.value)}
 placeholder={confirmTarget}
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
 Delete vikundi
 </>
 )}
 </Button>
 </AlertDialogFooter>
 </>
 )}
 </AlertDialogContent>
 </AlertDialog>
 </>
 );
}
