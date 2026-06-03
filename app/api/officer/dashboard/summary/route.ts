import { NextResponse } from "next/server";
import { shouldSoftEmptyApiError } from "@/lib/api-soft-fallback";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import {
 filterCustomersForLoanOfficer,
 loadBranchCustomersEnriched,
} from "@/lib/customer-portfolio";
import {
 applicationCountsForBranch,
 applicationCountsForOfficerPortfolio,
 appCountsFromBranchMetrics,
 extractApplicationsList,
 extractLoansList,
 mergeOfficerDashboardMetrics,
 portfolioMetricsFromOfficerLoans,
} from "@/lib/officer-dashboard-summary";
import { falcoServerFetch } from "@/lib/server-falco";

/** Officer dashboard: enriched customer portfolio + officer-scoped application counts. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request, ["loan_officer"]);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const branch_id = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 if (!branch_id) {
 return NextResponse.json({
 metrics: null,
 customerCount: 0,
 appCounts: { pending: 0, approved: 0, total: 0 },
 originatedCounts: { pending: 0, approved: 0, total: 0 },
 });
 }

 const officerId = auth.user.id;

 const [metricsRes, customers, applicationsRes, loansRes] = await Promise.all([
 falcoServerFetch<unknown>("/dashboard/metrics", { request, query: { branch_id } }),
 loadBranchCustomersEnriched(request, branch_id, { pageSize: "200" }),
 falcoServerFetch<unknown>("/applications", {
 request,
 query: { branch_id, page: "1", page_size: "200" },
 }),
 falcoServerFetch<unknown>("/loans", {
 request,
 query: { branch_id, page: "1", page_size: "100" },
 }),
 ]);

 let branchMetrics = metricsRes.ok ? (metricsRes.data as import("@/lib/manager-branch-load").ManagerMetricsPayload) : null;
 if (!metricsRes.ok && !shouldSoftEmptyApiError(auth.user, metricsRes.error.status)) {
 return NextResponse.json(
 { message: metricsRes.error.message, details: metricsRes.error.details },
 { status: metricsRes.error.status }
 );
 }

 const assignedCustomers = filterCustomersForLoanOfficer(customers, officerId);
 const customerCount = assignedCustomers.length;

 const allApplications = applicationsRes.ok ? extractApplicationsList(applicationsRes.data) : [];

 let appCounts = applicationsRes.ok
 ? applicationCountsForBranch(allApplications, branch_id)
 : appCountsFromBranchMetrics(branchMetrics);

 const originatedCounts = applicationsRes.ok
 ? applicationCountsForOfficerPortfolio(allApplications, officerId, assignedCustomers)
 : { pending: 0, approved: 0, total: 0 };

 const loans = loansRes.ok ? extractLoansList(loansRes.data) : [];
 const loanPortfolio = portfolioMetricsFromOfficerLoans(loans, assignedCustomers, officerId);
 const metrics = mergeOfficerDashboardMetrics(branchMetrics, loanPortfolio);

 return NextResponse.json({
 metrics,
 customerCount,
 appCounts,
 originatedCounts,
 });
}
