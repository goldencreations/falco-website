import { NextResponse } from "next/server";
import {
  extractFinancialEntriesPayload,
  mapUiFinancialEntryCreateToApi,
} from "@/lib/financial-entry-adapters";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

/** `GET /financial-entries` — branch cashbook: manual entries, synced repayments, fees, disbursements. */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const res = await falcoServerFetch<unknown>("/financial-entries", {
    request,
    query: {
      page: url.searchParams.get("page") ?? "1",
      page_size: url.searchParams.get("page_size") ?? "50",
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
    },
  });

  if (!res.ok) {
    const msg = formatFalcoApiError(res.error);
    return NextResponse.json(
      { message: msg, error: msg, details: res.error.details },
      { status: res.error.status }
    );
  }

  const payload = extractFinancialEntriesPayload(res.data);
  return NextResponse.json({
    data: payload.entries,
    entries: payload.entries,
    cashbook: payload.cashbook,
    meta: payload.meta ?? null,
  });
}

const MAY_MANAGE_CASHBOOK = new Set(["super_admin", "accountant"]);

/** `POST /financial-entries` — record a manual cashbook entry (accountant/admin only). */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const mayCreate =
    MAY_MANAGE_CASHBOOK.has(auth.user.role) ||
    auth.user.permissions?.includes("financial_entries.create");
  if (!mayCreate) {
    return NextResponse.json(
      { message: "You do not have permission to record cashbook entries." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON", error: "Invalid JSON" }, { status: 400 });
  }

  const mapped = mapUiFinancialEntryCreateToApi(body);
  const amount = Number(mapped.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      {
        message: "amount must be a positive number",
        error: "amount must be a positive number",
        details: [{ field: "amount", message: "Enter a valid amount." }],
      },
      { status: 400 }
    );
  }
  if (!mapped.category) {
    return NextResponse.json(
      {
        message: "category is required",
        error: "category is required",
        details: [{ field: "category", message: "Choose or enter a category." }],
      },
      { status: 400 }
    );
  }

  const res = await falcoServerFetch<unknown>("/financial-entries", {
    method: "POST",
    body: mapped,
    request,
  });

  if (!res.ok) {
    const msg = formatFalcoApiError(res.error);
    return NextResponse.json(
      { message: msg, error: msg, details: res.error.details },
      { status: res.error.status }
    );
  }

  return NextResponse.json(res.data, { status: 201 });
}
