import { NextResponse } from "next/server";
import { currentUser } from "@/lib/mock-data";
import { getDisbursementById, patchDisbursement } from "@/lib/mock-disbursement-data";
import type { DisbursementPatchAction } from "@/lib/disbursement-types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const row = getDisbursementById(id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ disbursement: row });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as Partial<DisbursementPatchAction> & {
    actor_id?: string;
  };

  const actor = body.actor_id ?? currentUser.id;

  if (body.action === "approve") {
    const patch: DisbursementPatchAction = { action: "approve", approved_by: actor };
    const result = patchDisbursement(id, patch);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ disbursement: result.disbursement });
  }

  if (body.action === "reject") {
    const patch: DisbursementPatchAction = {
      action: "reject",
      rejected_by: actor,
      rejection_reason: body.rejection_reason ?? null,
    };
    const result = patchDisbursement(id, patch);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ disbursement: result.disbursement });
  }

  if (body.action === "complete") {
    const patch: DisbursementPatchAction = {
      action: "complete",
      transaction_reference: body.transaction_reference ?? null,
      disbursed_at: body.disbursed_at ?? null,
    };
    const result = patchDisbursement(id, patch);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ disbursement: result.disbursement });
  }

  return NextResponse.json({ error: "action must be approve, reject, or complete" }, { status: 400 });
}
