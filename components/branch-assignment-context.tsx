"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { extractBranchesList } from "@/lib/branch-adapters";
import { extractUsersListPayload } from "@/lib/user-adapters";
import type { Branch, User } from "@/lib/types";

interface BranchAssignmentContextValue {
 branches: Branch[];
 users: User[];
 updateBranch: (branchId: string, updates: Partial<Branch>) => void;
 assignManager: (branchId: string, managerId: string | null) => Promise<string | null>;
 assignLoanOfficer: (officerId: string, branchId: string) => Promise<string | null>;
 removeLoanOfficer: (officerId: string, branchId: string) => Promise<string | null>;
 refresh: () => Promise<void>;
}

const BranchAssignmentContext = createContext<BranchAssignmentContextValue | null>(null);

type BranchAssignmentMode = "light" | "full";

export function BranchAssignmentProvider({
 children,
 mode = "full",
}: {
 children: ReactNode;
 /** `light` = branches only (portal dashboards). `full` = admin team/assignment screens. */
 mode?: BranchAssignmentMode;
}) {
 const [branches, setBranches] = useState<Branch[]>([]);
 const [users, setUsers] = useState<User[]>([]);

 const refresh = async () => {
 try {
 if (mode === "light") {
 const branchesRes = await fetch("/api/falco/branches", { credentials: "include" });
 if (branchesRes.ok) {
 const b = await branchesRes.json();
 setBranches(extractBranchesList(b));
 }
 return;
 }

 const [branchesRes, usersRes, managersRes, officersRes] = await Promise.all([
 fetch("/api/falco/branches", { credentials: "include" }),
 fetch("/api/staff/directory?page_size=500", { credentials: "include" }),
 fetch("/api/staff/directory?page_size=500&role=branch_manager", { credentials: "include" }),
 fetch("/api/staff/directory?page_size=500&role=loan_officer", { credentials: "include" }),
 ]);
 if (branchesRes.ok) {
 const b = await branchesRes.json();
 setBranches(extractBranchesList(b));
 }
 const merged = new Map<string, User>();
 for (const res of [usersRes, managersRes, officersRes]) {
 if (!res.ok) continue;
 const u = await res.json();
 for (const user of extractUsersListPayload(u).users) {
 if (user.id) merged.set(user.id, user);
 }
 }
 if (merged.size) setUsers(Array.from(merged.values()));
 } catch {
 /* keep previous */
 }
 };

 useEffect(() => {
 void refresh();
 }, []);

 const updateBranch = (branchId: string, updates: Partial<Branch>) => {
 setBranches((prev) =>
 prev.map((branch) => (branch.id === branchId ? { ...branch, ...updates } : branch))
 );
 };

 const assignManager = async (branchId: string, managerId: string | null): Promise<string | null> => {
 try {
 const res = await fetch(`/api/falco/branches/${encodeURIComponent(branchId)}/manager`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ manager_id: managerId }),
 });
 const json = (await res.json().catch(() => ({}))) as { message?: string };
 if (!res.ok) {
 return json.message ?? "Could not assign branch manager";
 }
 await refresh();
 return null;
 } catch {
 return "Could not assign branch manager";
 }
 };

 const assignLoanOfficer = async (officerId: string, branchId: string): Promise<string | null> => {
 try {
 const res = await fetch(`/api/falco/branches/${encodeURIComponent(branchId)}/officers`, {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ user_id: officerId }),
 });
 const json = (await res.json().catch(() => ({}))) as { message?: string };
 if (!res.ok) {
 return json.message ?? "Could not assign loan officer";
 }
 await refresh();
 return null;
 } catch {
 return "Could not assign loan officer";
 }
 };

 const removeLoanOfficer = async (officerId: string, branchId: string): Promise<string | null> => {
 try {
 const res = await fetch(
 `/api/falco/branches/${encodeURIComponent(branchId)}/officers/${encodeURIComponent(officerId)}`,
 { method: "DELETE", credentials: "include" }
 );
 const json = (await res.json().catch(() => ({}))) as { message?: string };
 if (!res.ok) {
 return json.message ?? "Could not remove loan officer";
 }
 await refresh();
 return null;
 } catch {
 return "Could not remove loan officer";
 }
 };

 const value = useMemo(
 () => ({
 branches,
 users,
 updateBranch,
 assignManager,
 assignLoanOfficer,
 removeLoanOfficer,
 refresh,
 }),
 [branches, users]
 );

 return (
 <BranchAssignmentContext.Provider value={value}>{children}</BranchAssignmentContext.Provider>
 );
}

export function useOptionalBranchAssignment() {
 return useContext(BranchAssignmentContext);
}

export function useBranchAssignment() {
 const context = useOptionalBranchAssignment();
 if (!context) {
 throw new Error("useBranchAssignment must be used within BranchAssignmentProvider");
 }
 return context;
}
