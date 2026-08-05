import { NextResponse } from "next/server";
import { adaptApiDisbursementRow } from "@/lib/disbursement-adapters";
import { enrichDisbursementRowsWithUserNames } from "@/lib/disbursement-enrichment";
import { canApproveDisbursement } from "@/lib/disbursement-permissions";
import { requireApiUser, ensureResourceBranchAllowed } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

function loanIdFromDisbursementPayload(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  const d =
    o.disbursement && typeof o.disbursement === "object"
      ? (o.disbursement as Record<string, unknown>)
      : o;
  const lid = d.loan_id ?? d.loanId;
  return lid != null ? String(lid) : undefined;
}

/**
 * `POST /disbursements/{id}/retry` — start a new ClickPesa payout after a reversed/failed attempt.
 * Requires `confirmed_not_paid: true` and a stable `Idempotency-Key` for the reviewed action.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  if (!canApproveDisbursement(auth.user)) {
    return NextResponse.json(
      { message: "You do not have permission to retry disbursements." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Disbursement id is required" }, { status: 400 });
  }

  const pre = await falcoServerFetch<unknown>(`/disbursements/${encodeURIComponent(id)}`, {
    request,
  });
  if (pre.ok) {
    const loanId = loanIdFromDisbursementPayload(pre.data);
    if (loanId) {
      const lr = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(loanId)}`, {
        request,
      });
      if (lr.ok) {
        const row = lr.data && typeof lr.data === "object" ? (lr.data as Record<string, unknown>) : null;
        const inner =
          row?.loan && typeof row.loan === "object" ? (row.loan as Record<string, unknown>) : row;
        const rid = inner?.branch_id != null ? String(inner.branch_id) : undefined;
        const denied = ensureResourceBranchAllowed(auth.user, rid);
        if (denied) return denied;
      }
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (body.confirmed_not_paid !== true) {
    return NextResponse.json(
      {
        message: "Confirmation required",
        details: [
          {
            field: "confirmed_not_paid",
            message: "You must confirm this payout was not paid in ClickPesa before retrying.",
          },
        ],
      },
      { status: 422 }
    );
  }

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) {
    return NextResponse.json(
      {
        message: "Idempotency-Key header is required",
        details: [{ field: "Idempotency-Key", message: "Provide a stable unique key for this retry." }],
      },
      { status: 422 }
    );
  }

  const res = await falcoServerFetch<unknown>(
    `/disbursements/${encodeURIComponent(id)}/retry`,
    {
      method: "POST",
      body: { confirmed_not_paid: true },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      request,
    }
  );

  if (!res.ok) {
    const msg = formatFalcoApiError(res.error);
    return NextResponse.json(
      {
        message: msg,
        error: msg,
        code: res.error.code,
        details: res.error.details,
      },
      { status: res.error.status }
    );
  }

  const data = res.data;
  let enrichedDisbursement: unknown = null;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const row = o.disbursement && typeof o.disbursement === "object" ? o.disbursement : null;
    if (row) {
      const adapted = adaptApiDisbursementRow(row as Record<string, unknown>);
      const [enriched] = await enrichDisbursementRowsWithUserNames([adapted]);
      enrichedDisbursement = enriched;
    }
  }

  const payload =
    data && typeof data === "object"
      ? {
          ...(data as Record<string, unknown>),
          ...(enrichedDisbursement ? { disbursement: enrichedDisbursement } : {}),
        }
      : { data };

  // Accepted for processing — never treat as completed on the client.
  return NextResponse.json(payload, { status: 202 });
}
