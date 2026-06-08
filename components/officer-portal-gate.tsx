"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginRedirectForRole } from "@/lib/role-portal";
import { useOfficerSession } from "@/components/officer-session-context";
import { useSessionUser } from "@/lib/use-session-user";

export function OfficerPortalGate({ children }: { children: React.ReactNode }) {
 const router = useRouter();
 const serverUser = useOfficerSession();
 const { user: clientUser, loaded } = useSessionUser();

 useEffect(() => {
 if (!loaded) return;
 if (!clientUser) {
 router.replace("/");
 return;
 }
 if (clientUser.role !== "loan_officer") {
 router.replace(loginRedirectForRole(clientUser.role));
 }
 }, [loaded, clientUser, router]);

 const missingBranch = !serverUser.branch_id?.trim();

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
