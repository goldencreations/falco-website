import { NextResponse } from "next/server";
import {
  dedupeOfficersForMetrics,
  fetchBranchRegisteredStaffRegistry,
  resolveBranchLoanOfficerRoster,
} from "@/lib/branch-summary-fallback";
import { buildBranchOfficerNameMap } from "@/lib/officer-branch-roster";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { extractApplicationsList } from "@/lib/application-adapters";
import { loadBranchCustomersEnriched } from "@/lib/customer-portfolio";
import { extractLeadsList } from "@/lib/lead-adapters";
import { extractLoansList } from "@/lib/loan-adapters";
import {
  computeOfficerPeerPerformance,
  getOfficerPerformancePeriodRange,
  isOfficerPerformancePeriod,
  officerPeerDisplayName,
  pickBestOfficerDisplayName,
  rankOfficerPeerPerformance,
  type OfficerPerformancePeriod,
  type OfficerPeerPerformanceRow,
} from "@/lib/officer-peer-performance";
import { extractPaymentsPayload } from "@/lib/payment-adapters";
import { falcoServerFetch } from "@/lib/server-falco";
import { adaptApiUserToUser } from "@/lib/user-adapters";

function normName(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function enrichPeerRowName(
  row: Omit<OfficerPeerPerformanceRow, "rank">,
  nameMap: Map<string, string>,
  registry: Map<string, User>,
  sessionUserId: string,
  sessionUserName: string
): Omit<OfficerPeerPerformanceRow, "rank"> {
  const full_name =
    pickBestOfficerDisplayName(
      row.user_id === sessionUserId ? sessionUserName : undefined,
      nameMap.get(row.user_id),
      registry.get(row.user_id)?.full_name,
      row.full_name
    ) || row.full_name;
  return { ...row, full_name };
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request, ["loan_officer"]);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const branch_id = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
  const periodParam = url.searchParams.get("period") ?? "month";
  const period: OfficerPerformancePeriod = isOfficerPerformancePeriod(periodParam)
    ? periodParam
    : "month";
  const range = getOfficerPerformancePeriodRange(period);

  if (!branch_id) {
    return NextResponse.json({
      period,
      range,
      officers: [] as OfficerPeerPerformanceRow[],
      currentUserId: auth.user.id,
    });
  }

  const [customers, customersRes, applicationsRes, loansRes, paymentsRes, leadsRes, summaryRes, exportRes, registry] =
    await Promise.all([
      loadBranchCustomersEnriched(request, branch_id, { pageSize: "500" }),
      falcoServerFetch<unknown>("/customers", {
        request,
        query: { branch_id, is_active: "true", page: "1", page_size: "500" },
      }),
      falcoServerFetch<unknown>("/applications", {
        request,
        query: { branch_id, page: "1", page_size: "500" },
      }),
      falcoServerFetch<unknown>("/loans", {
        request,
        query: { branch_id, page: "1", page_size: "500" },
      }),
      falcoServerFetch<unknown>("/payments", {
        request,
        query: {
          branch_id,
          page: "1",
          page_size: "500",
          status: "completed",
        },
      }),
      falcoServerFetch<unknown>("/leads", {
        request,
        query: { branch_id, page: "1", page_size: "500" },
      }),
      falcoServerFetch<unknown>("/branches/summary", { request }),
      falcoServerFetch<unknown>(`/branches/${encodeURIComponent(branch_id)}/export`, { request }),
      fetchBranchRegisteredStaffRegistry(auth.user, branch_id, request),
    ]);

  const applications = applicationsRes.ok ? extractApplicationsList(applicationsRes.data) : [];
  const loans = loansRes.ok ? extractLoansList(loansRes.data) : [];
  const payments = paymentsRes.ok ? extractPaymentsPayload(paymentsRes.data).payments : [];
  const leads = leadsRes.ok ? extractLeadsList(leadsRes.data) : [];

  const apiPayloads = {
    rawApplications: applicationsRes.ok ? applicationsRes.data : undefined,
    rawLoans: loansRes.ok ? loansRes.data : undefined,
    rawCustomers: customersRes.ok ? customersRes.data : undefined,
    rawPayments: paymentsRes.ok ? paymentsRes.data : undefined,
    rawBranchesSummary: summaryRes.ok ? summaryRes.data : undefined,
    rawBranchExport: exportRes.ok ? exportRes.data : undefined,
  };

  const branchOfficers = dedupeOfficersForMetrics(
    await resolveBranchLoanOfficerRoster(
      auth.user,
      branch_id,
      {
        customers,
        applications,
        loans,
        apiPayloads,
      },
      request
    ),
    apiPayloads,
    registry
  );

  const nameMap = buildBranchOfficerNameMap(branchOfficers, apiPayloads, registry);
  const metricCtx = { customers, loans, applications, payments, leads };

  const rows = branchOfficers
    .map((officer) => {
      const row = computeOfficerPeerPerformance(officer, metricCtx, range);
      return enrichPeerRowName(
        {
          ...row,
          employee_id: officer.employee_id?.trim() || row.employee_id,
        },
        nameMap,
        registry,
        auth.user.id,
        auth.user.full_name
      );
    })
    .filter((row) => {
      const label = officerPeerDisplayName(row, nameMap.get(row.user_id));
      return label !== "Unknown officer";
    });

  const sessionOfficer =
    branchOfficers.find((officer) => officer.id === auth.user.id) ??
    adaptApiUserToUser({
      id: auth.user.id,
      email: auth.user.email,
      full_name: auth.user.full_name,
      role: "loan_officer",
      branch_id: auth.user.branch_id,
      employee_id: registry.get(auth.user.id)?.employee_id ?? "",
      phone: registry.get(auth.user.id)?.phone ?? "",
      is_active: true,
    });

  if (!rows.some((row) => row.user_id === auth.user.id)) {
    rows.push(
      enrichPeerRowName(
        {
          ...computeOfficerPeerPerformance(sessionOfficer, metricCtx, range),
          employee_id: sessionOfficer.employee_id?.trim() || "",
        },
        nameMap,
        registry,
        auth.user.id,
        auth.user.full_name
      )
    );
  }

  const officers = rankOfficerPeerPerformance(rows);
  const currentUser =
    officers.find((row) => row.user_id === auth.user.id) ??
    officers.find((row) => normName(row.full_name) === normName(auth.user.full_name)) ??
    null;
  const topPerformer = officers[0] ?? null;

  return NextResponse.json({
    period,
    range,
    officers,
    topPerformer,
    totalOfficers: officers.length,
    currentUser,
    currentUserId: auth.user.id,
    currentUserFullName: auth.user.full_name,
    officerCount: branchOfficers.length,
  });
}
