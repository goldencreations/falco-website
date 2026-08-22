import { NextResponse } from "next/server";
import {
  extractFinancialEntriesPayload,
  mapUiFinancialEntryCreateToApi,
} from "@/lib/financial-entry-adapters";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";
import type { SessionUser } from "@/lib/auth";

const UNCLASSIFIED_QUEUE_CATEGORY = "unclassified_gateway_income";
const FINANCIAL_ENTRIES_UNASSIGNED_VIEW = "financial_entries.unassigned.view";

function canViewOrgWideUnmatchedQueue(user: SessionUser): boolean {
  return (
    user.role === "accountant" ||
    user.role === "super_admin" ||
    Boolean(user.permissions?.includes(FINANCIAL_ENTRIES_UNASSIGNED_VIEW))
  );
}

function resolveCashbookBranchId(
  auth: { user: SessionUser },
  options: {
    unmatchedQueue: boolean;
    clientBranchId: string | null;
  }
): string | undefined {
  const { unmatchedQueue, clientBranchId } = options;

  if (unmatchedQueue) {
    if (auth.user.role === "branch_manager" || auth.user.role === "loan_officer") {
      return auth.user.branch_id?.trim() || undefined;
    }
    // Unassigned unmatched receipts have branch_id null until classified — never scope by branch here.
    if (canViewOrgWideUnmatchedQueue(auth.user)) {
      return undefined;
    }
    return clientBranchId?.trim() || undefined;
  }

  if (auth.user.role === "accountant") {
    return clientBranchId?.trim() || auth.user.branch_id?.trim() || undefined;
  }

  if (auth.user.role === "super_admin") {
    return clientBranchId?.trim() || undefined;
  }

  return resolvedBranchIdForListQuery(auth.user, clientBranchId);
}

function buildBackendQuery(
  url: URL,
  options: {
    branchId?: string;
    needsClassification: boolean;
    category?: string;
    includeClassificationHints: boolean;
  }
) {
  const source = url.searchParams.get("source") ?? undefined;
  const pageSize =
    url.searchParams.get("page_size") ??
    (options.needsClassification || options.includeClassificationHints ? "500" : "50");

  const query: Record<string, string | undefined> = {
    page: url.searchParams.get("page") ?? "1",
    page_size: pageSize,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    direction: url.searchParams.get("direction") ?? undefined,
    source,
    status: url.searchParams.get("status") ?? undefined,
    branch_id: options.branchId,
  };

  if (options.needsClassification) {
    query.category = undefined;
    query.needs_classification = "1";
  } else if (options.category) {
    query.category = options.category;
  }

  return query;
}

/** `GET /financial-entries` — branch cashbook: manual entries, synced repayments, fees, disbursements. */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const source = url.searchParams.get("source") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const needsClassification = url.searchParams.get("needs_classification") === "1";
  const unmatchedQueue =
    needsClassification ||
    (source === "clickpesa" && category === UNCLASSIFIED_QUEUE_CATEGORY);
  const clientBranchId = url.searchParams.get("branch_id");
  const branchId = resolveCashbookBranchId(auth, { unmatchedQueue, clientBranchId });

  const runQuery = async (query: Record<string, string | undefined>) => {
    const res = await falcoServerFetch<unknown>("/financial-entries", {
      request,
      query,
    });
    if (!res.ok) return { ok: false as const, error: res.error };
    return { ok: true as const, payload: extractFinancialEntriesPayload(res.data) };
  };

  const primaryQuery = buildBackendQuery(url, {
    branchId,
    needsClassification,
    category: needsClassification ? undefined : category,
    includeClassificationHints: needsClassification,
  });

  let payload = extractFinancialEntriesPayload(null);
  const primary = await runQuery(primaryQuery);

  if (needsClassification) {
    const legacyQuery = buildBackendQuery(url, {
      branchId,
      needsClassification: false,
      category: UNCLASSIFIED_QUEUE_CATEGORY,
      includeClassificationHints: true,
    });

    if (!primary.ok) {
      const legacy = await runQuery(legacyQuery);
      if (!legacy.ok) {
        const msg = formatFalcoApiError(primary.error);
        return NextResponse.json(
          { message: msg, error: msg, details: primary.error.details },
          { status: primary.error.status }
        );
      }
      payload = legacy.payload;
    } else {
      payload = primary.payload;
      if (payload.entries.length === 0) {
        const legacy = await runQuery(legacyQuery);
        if (legacy.ok && legacy.payload.entries.length > 0) {
          payload = legacy.payload;
        }
      }
    }
  } else if (!primary.ok) {
    const msg = formatFalcoApiError(primary.error);
    return NextResponse.json(
      { message: msg, error: msg, details: primary.error.details },
      { status: primary.error.status }
    );
  } else {
    payload = primary.payload;
  }

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
