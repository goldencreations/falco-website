import { NextResponse } from "next/server";
import { mapUiFinancialEntryAllocateToGroupToApi } from "@/lib/financial-entry-adapters";
import { requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

const MAY_ALLOCATE = new Set(["super_admin", "accountant"]);

/**
 * `POST /financial-entries/{id}/allocate-to-group` — verified unmatched ClickPesa receipt
 * becomes Payment(s) on the group's payable loans.
 * The frontend must not send amount, member splits, or call POST /payments.
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
      { message: "You do not have permission to allocate this receipt to group loans." },
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

  const mapped = mapUiFinancialEntryAllocateToGroupToApi(body);
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
  if (mapped.group_id == null || mapped.group_id === "") {
    return NextResponse.json(
      {
        message: "group_id is required",
        error: "group_id is required",
        details: [{ field: "group_id", message: "Select a group." }],
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
  if (!Array.isArray(mapped.allocations) || mapped.allocations.length === 0) {
    return NextResponse.json(
      {
        message: "allocations is required",
        error: "allocations is required",
        details: [
          {
            field: "allocations",
            message: "Split the receipt across at least one group loan.",
          },
        ],
      },
      { status: 400 }
    );
  }

  const res = await falcoServerFetch<unknown>(
    `/financial-entries/${encodeURIComponent(id)}/allocate-to-group`,
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
