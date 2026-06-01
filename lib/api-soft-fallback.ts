import type { SessionUser } from "@/lib/auth";
import { isBranchDataScoped } from "@/lib/authorization";

/** When branch-scoped staff lack backend permission, return empty data instead of 403 so portals stay usable. */
export function shouldSoftEmptyApiError(user: SessionUser, status: number): boolean {
 return (status === 403 || status === 404) && isBranchDataScoped(user);
}
