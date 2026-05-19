import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { fetchBranchesForSessionUser } from "@/lib/branch-summary-fallback";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import {
 buildOfficerPortfolioSummaryPayload,
 loadOfficerLoansForReports,
 officerPortfolioSummaryToCsv,
} from "@/lib/officer-reports-server";
import { resolveFalcoAccessToken } from "@/lib/server-falco";

/** Proxies `GET /reports/portfolio-summary/export?format=csv` from the LMS. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const format = (url.searchParams.get("format") || "csv").toLowerCase();
 if (format !== "csv") {
 return NextResponse.json(
 { message: "Only CSV export is supported for portfolio summary at this time." },
 { status: 400 }
 );
 }

 const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 const asOf = url.searchParams.get("as_of")?.trim() || new Date().toISOString().slice(0, 10);

 if (auth.user.role === "loan_officer") {
 if (!branchId) {
 return NextResponse.json({ message: "Your account is not linked to a branch." }, { status: 400 });
 }
 const loans = await loadOfficerLoansForReports(request, branchId, auth.user.id);
 const branches = await fetchBranchesForSessionUser(auth.user);
 const branchName = branches.find((b) => b.id === branchId)?.name ?? branchId;
 const payload = buildOfficerPortfolioSummaryPayload(loans, asOf, branchId, branchName);
 const csv = officerPortfolioSummaryToCsv(payload, branchName);
 return new NextResponse(csv, {
 status: 200,
 headers: {
 "Content-Type": "text/csv; charset=utf-8",
 "Content-Disposition": `attachment; filename="portfolio-summary-${asOf}.csv"`,
 },
 });
 }

 const token = await resolveFalcoAccessToken(request);
 if (!token) {
 return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
 }

 const params = new URLSearchParams({ format: "csv" });
 if (branchId) params.set("branch_id", branchId);
 if (asOf) params.set("as_of", asOf);

 const res = await fetch(
 `${getFalcoApiBaseUrl()}/reports/portfolio-summary/export?${params.toString()}`,
 {
 method: "GET",
 headers: {
 Authorization: `Bearer ${token}`,
 Accept: "text/csv, application/json",
 "User-Agent": "FalcoWebsite/1.0 (Next.js)",
 },
 cache: "no-store",
 }
 );

 const text = await res.text();
 if (!res.ok) {
 let message = "Export failed";
 try {
 const j = JSON.parse(text) as { message?: string; error?: { message?: string } };
 message =
 typeof j.message === "string"
 ? j.message
 : typeof j.error?.message === "string"
 ? j.error.message
 : message;
 } catch {
 if (text) message = text.slice(0, 200);
 }
 return NextResponse.json({ message }, { status: res.status });
 }

 return new NextResponse(text, {
 status: 200,
 headers: {
 "Content-Type": "text/csv; charset=utf-8",
 "Content-Disposition": `attachment; filename="portfolio-summary-${asOf || "latest"}.csv"`,
 },
 });
}
