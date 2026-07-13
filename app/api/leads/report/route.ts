import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";
import { extractLeadsList, type LeadView } from "@/lib/lead-adapters";
import { buildLeadsReportWorkbook, leadsReportFilename } from "@/lib/leads-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** ISO-ish date, e.g. "2026-06-13". Accepts any parseable YYYY-MM-DD prefix. */
function isValidDateParam(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Generates the branded "Field Leads Report" .xlsx for the requested date range. */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const from = url.searchParams.get("from")?.trim() ?? "";
  const to = url.searchParams.get("to")?.trim() ?? "";

  if (!from || !to || !isValidDateParam(from) || !isValidDateParam(to)) {
    return NextResponse.json(
      { message: "Choose a valid start and end date for the report." },
      { status: 422 }
    );
  }
  if (from > to) {
    return NextResponse.json(
      { message: "The start date must be on or before the end date." },
      { status: 422 }
    );
  }

  const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));

  const leads: LeadView[] = [];
  const pageSize = 100;
  let page = 1;
  for (;;) {
    const res = await falcoServerFetch<unknown>("/leads", {
      request,
      query: {
        follow_up_from: from,
        follow_up_to: to,
        branch_id: branchId,
        page: String(page),
        page_size: String(pageSize),
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { message: res.error.message, details: res.error.details },
        { status: res.error.status }
      );
    }

    const pageLeads = extractLeadsList(res.data);
    leads.push(...pageLeads);

    const meta =
      res.data && typeof res.data === "object"
        ? (res.data as { meta?: { total?: number } }).meta
        : undefined;
    const total = meta?.total ?? leads.length;

    if (pageLeads.length === 0 || leads.length >= total || page >= 50) break;
    page += 1;
  }

  const buffer = await buildLeadsReportWorkbook({
    leads,
    from,
    to,
    generatedByName: auth.user.full_name,
    generatedByRole: auth.user.role,
  });

  const filename = leadsReportFilename({ generatedByName: auth.user.full_name, from, to });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
