"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { branches as baseBranches, users as baseUsers } from "@/lib/mock-data";
import type { Branch, User } from "@/lib/types";

interface BranchAssignmentContextValue {
  branches: Branch[];
  users: User[];
  addBranch: (branch: Branch) => void;
  updateBranch: (branchId: string, updates: Partial<Branch>) => void;
  assignManager: (branchId: string, managerId: string | null) => void;
  assignLoanOfficer: (officerId: string, branchId: string) => void;
  removeLoanOfficer: (officerId: string) => void;
}

const BranchAssignmentContext = createContext<BranchAssignmentContextValue | null>(null);

export function BranchAssignmentProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>(baseBranches);
  const [users, setUsers] = useState<User[]>(baseUsers);

  const addBranch = (branch: Branch) => {
    setBranches((prev) => [branch, ...prev]);
  };

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
      addBranch,
      updateBranch,
      assignManager,
      assignLoanOfficer,
      removeLoanOfficer,
    }),
    [branches, users]
  );

  return (
    <BranchAssignmentContext.Provider value={value}>
      {children}
    </BranchAssignmentContext.Provider>
  );
}

export function useBranchAssignment() {
  const context = useContext(BranchAssignmentContext);
  if (!context) {
    throw new Error("useBranchAssignment must be used within BranchAssignmentProvider");
  }
  return context;
}
