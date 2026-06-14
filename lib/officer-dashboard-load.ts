import type { ManagerMetricsPayload } from "@/lib/manager-branch-load";

export type OfficerDashboardSnapshot = {
 branchName?: string;
 metrics: ManagerMetricsPayload | null;
 customerCount: number;
 /** Branch-wide (matches `/officer/applications` list). */
 appCounts: { pending: number; approved: number; total: number };
 /** Officer portfolio / originated apps. */
 originatedCounts: { pending: number; approved: number; total: number };
};

/** Fast officer dashboard: single summary API (metrics + counts, no list hydration). */
export async function loadOfficerDashboardSnapshot(
 branchId: string
): Promise<OfficerDashboardSnapshot> {
 const params = new URLSearchParams();
 params.set("branch_id", branchId);

 const res = await fetch(`/api/officer/dashboard/summary?${params.toString()}`, {
 credentials: "include",
 });
 if (!res.ok) {
 throw new Error("Failed to load dashboard summary");
 }
 return (await res.json()) as OfficerDashboardSnapshot;
}
