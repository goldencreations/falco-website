import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

const MAY_REVERSE = new Set(["super_admin", "accountant"]);

/** `POST /financial-entries/{id}/reverse` — reverse a manual cashbook entry with a reason. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const mayReverse =
    MAY_REVERSE.has(auth.user.role) || auth.user.permissions?.includes("financial_entries.reverse");
  if (!mayReverse) {
    return NextResponse.json(
      { message: "You do not have permission to reverse cashbook entries." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const reason = String(body.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json(
      { message: "A reversal reason is required.", details: [{ field: "reason", message: "Enter a reason." }] },
      { status: 400 }
    );
  }

  const res = await falcoServerFetch<unknown>(`/financial-entries/${encodeURIComponent(id)}/reverse`, {
    method: "POST",
    body: { reason },
    request,
  });
  if (!res.ok) {
    const message = formatFalcoApiError(res.error);
    return NextResponse.json(
      { message, error: message, details: res.error.details },
      { status: res.error.status }
    );
  }

  return NextResponse.json(res.data);
}
