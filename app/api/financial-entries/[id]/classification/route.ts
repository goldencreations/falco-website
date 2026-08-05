import { NextResponse } from "next/server";
import { mapUiFinancialEntryClassificationToApi } from "@/lib/financial-entry-adapters";
import { requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

const MAY_CLASSIFY = new Set(["super_admin", "accountant"]);

/**
 * `PATCH /financial-entries/{id}/classification` — attach branch, customer, income type,
 * category, and notes to an unmatched ClickPesa receipt so it stops showing as unclassified.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const mayClassify =
    MAY_CLASSIFY.has(auth.user.role) || auth.user.permissions?.includes("financial_entries.classify");
  if (!mayClassify) {
    return NextResponse.json(
      { message: "You do not have permission to classify cashbook entries." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON", error: "Invalid JSON" }, { status: 400 });
  }

  const mapped = mapUiFinancialEntryClassificationToApi(body);
  if (!mapped.category) {
    return NextResponse.json(
      {
        message: "category is required",
        error: "category is required",
        details: [{ field: "category", message: "Choose a category for this receipt." }],
      },
      { status: 400 }
    );
  }

  const res = await falcoServerFetch<unknown>(`/financial-entries/${encodeURIComponent(id)}/classification`, {
    method: "PATCH",
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

  return NextResponse.json(res.data);
}
