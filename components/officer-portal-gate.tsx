"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { loginRedirectForRole } from "@/lib/role-portal";
import { useSessionUser } from "@/lib/use-session-user";

function OfficerLoadingShell() {
 return (
 <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
 <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
 <p className="text-sm">Loading officer portal…</p>
 </div>
 );
}

export function OfficerPortalGate({ children }: { children: React.ReactNode }) {
 const router = useRouter();
 const { user, loaded } = useSessionUser();

 useEffect(() => {
 if (!loaded) return;
 if (!user) {
 router.replace("/");
 return;
 }
 if (user.role !== "loan_officer") {
 router.replace(loginRedirectForRole(user.role));
 }
 }, [loaded, user, router]);

 if (!loaded) return <OfficerLoadingShell />;
 if (!user || user.role !== "loan_officer") return <OfficerLoadingShell />;

 const missingBranch = !user.branch_id?.trim();

 return (
 <>
 {missingBranch ? (
 <div
 className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950"
 role="status"
 >
 <strong>Branch not assigned.</strong> Some data may be unavailable until an administrator
 links your account to a branch. Contact your branch manager if this persists.
 </div>
 ) : null}
 {children}
 </>
 );
}
