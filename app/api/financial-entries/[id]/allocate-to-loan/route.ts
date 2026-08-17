import { NextResponse } from "next/server";
import { mapUiFinancialEntryAllocateToLoanToApi } from "@/lib/financial-entry-adapters";
import { requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

const MAY_ALLOCATE = new Set(["super_admin", "accountant"]);

/**
 * `POST /financial-entries/{id}/allocate-to-loan` — verified unmatched ClickPesa receipt
 * becomes a Payment on the selected loan (penalty → fees → interest → principal).
 * The frontend must not send amount or call POST /payments.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const mayAllocate =
    MAY_ALLOCATE.has(auth.user.role) ||
    auth.user.permissions?.includes("payments.create") ||
    auth.user.permissions?.includes("financial_entries.classify");
  if (!mayAllocate) {
    return NextResponse.json(
      { message: "You do not have permission to allocate this receipt to a loan." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Financial entry id is required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON", error: "Invalid JSON" }, { status: 400 });
  }

  const mapped = mapUiFinancialEntryAllocateToLoanToApi(body);
  if (!mapped.branch_id) {
    return NextResponse.json(
      {
        message: "branch_id is required",
        error: "branch_id is required",
        details: [{ field: "branch_id", message: "Select a branch." }],
      },
      { status: 400 }
    );
  }
  if (mapped.customer_id == null || mapped.customer_id === "") {
    return NextResponse.json(
      {
        message: "customer_id is required",
        error: "customer_id is required",
        details: [{ field: "customer_id", message: "Select a customer." }],
      },
      { status: 400 }
    );
  }
  if (mapped.loan_id == null || mapped.loan_id === "") {
    return NextResponse.json(
      {
        message: "loan_id is required",
        error: "loan_id is required",
        details: [{ field: "loan_id", message: "Select an active or in-arrears loan." }],
      },
      { status: 400 }
    );
  }
  if (!mapped.notes) {
    return NextResponse.json(
      {
        message: "notes are required",
        error: "notes are required",
        details: [{ field: "notes", message: "Enter verification notes." }],
      },
      { status: 400 }
    );
  }

  const res = await falcoServerFetch<unknown>(
    `/financial-entries/${encodeURIComponent(id)}/allocate-to-loan`,
    {
      method: "POST",
      body: mapped,
      request,
    }
  );

  if (!res.ok) {
    const msg = formatFalcoApiError(res.error);
    return NextResponse.json(
      { message: msg, error: msg, details: res.error.details },
      { status: res.error.status }
    );
  }

  const alreadyAllocated =
    res.data &&
    typeof res.data === "object" &&
    (res.data as { already_allocated?: boolean }).already_allocated === true;
  return NextResponse.json(res.data ?? { message: "Allocated" }, {
    status: alreadyAllocated ? 200 : 201,
  });
}
