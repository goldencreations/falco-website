"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { extractBranchesList } from "@/lib/branch-adapters";
import { extractUsersListPayload } from "@/lib/user-adapters";
import type { Branch, User } from "@/lib/types";

interface BranchAssignmentContextValue {
 branches: Branch[];
 users: User[];
 updateBranch: (branchId: string, updates: Partial<Branch>) => void;
 assignManager: (branchId: string, managerId: string | null) => void;
 assignLoanOfficer: (officerId: string, branchId: string) => void;
 removeLoanOfficer: (officerId: string) => void;
 refresh: () => Promise<void>;
}

const BranchAssignmentContext = createContext<BranchAssignmentContextValue | null>(null);

export function BranchAssignmentProvider({ children }: { children: ReactNode }) {
 const [branches, setBranches] = useState<Branch[]>([]);
 const [users, setUsers] = useState<User[]>([]);

 const refresh = async () => {
 try {
 const [branchesRes, usersRes] = await Promise.all([
 fetch("/api/falco/branches", { credentials: "include" }),
 fetch("/api/staff/directory?page_size=200", { credentials: "include" }),
 ]);
 if (branchesRes.ok) {
 const b = await branchesRes.json();
 setBranches(extractBranchesList(b));
 }
 if (usersRes.ok) {
 const u = await usersRes.json();
 setUsers(extractUsersListPayload(u).users);
 }
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

 const assignManager = (branchId: string, managerId: string | null) => {
 setBranches((prev) =>
 prev.map((branch) =>
 branch.id === branchId ? { ...branch, manager_id: managerId ?? "" } : branch
 )
 );

 if (!managerId) return;

 setUsers((prev) =>
 prev.map((user) => {
 if (user.id === managerId && user.role === "branch_manager") {
 return { ...user, branch_id: branchId };
 }
 return user;
 })
 );
 };

 const assignLoanOfficer = (officerId: string, branchId: string) => {
 setUsers((prev) =>
 prev.map((user) => {
 if (user.id === officerId && user.role === "loan_officer") {
 return { ...user, branch_id: branchId };
 }
 return user;
 })
 );
 };

 const removeLoanOfficer = (officerId: string) => {
 setUsers((prev) =>
 prev.map((user) => {
 if (user.id === officerId && user.role === "loan_officer") {
 return { ...user, branch_id: "" };
 }
 return user;
 })
 );
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
