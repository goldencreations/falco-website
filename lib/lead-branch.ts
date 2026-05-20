import type { SessionUser } from "@/lib/auth";

/** Resolve `branch_id` for `POST /leads` from session and optional client body. */
export function resolveLeadCreateBranchId(
 user: SessionUser,
 body: Record<string, unknown>
): { branchId: string } | { error: string } {
 const fromUser = user.branch_id?.trim();
 if (fromUser) return { branchId: fromUser };

 const fromBody =
 typeof body.branch_id === "string"
 ? body.branch_id.trim()
 : typeof body.branchId === "string"
 ? body.branchId.trim()
 : "";

 if (fromBody) return { branchId: fromBody };

 return {
 error:
 user.role === "super_admin"
 ? "Select a branch for this lead."
 : "Your account is not assigned to a branch. Contact an administrator.",
 };
}
