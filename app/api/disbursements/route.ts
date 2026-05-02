import { NextResponse } from "next/server";
import { currentUser } from "@/lib/mock-data";
import {
  createDisbursement,
  getDisbursementKpis,
  getEligibleLoansForDisbursement,
  getRemainingPrincipalBucket,
  listDisbursements,
} from "@/lib/mock-disbursement-data";
import type {
  DisbursementCreateInput,
  DisbursementStatus,
} from "@/lib/disbursement-types";

const STATUSES: DisbursementStatus[] = [
  "pending_approval",
  "approved",
  "completed",
  "rejected",
];

const CHANNELS: DisbursementCreateInput["method"][] = [
  "mpesa",
  "airtel_money",
  "yas",
  "halopesa",
  "crdb",
  "nmb",
  "cash",
  "other",
];

function parseStatus(v: string | null): DisbursementStatus | "all" | undefined {
  if (!v || v === "all") return "all";
  if (STATUSES.includes(v as DisbursementStatus)) return v as DisbursementStatus;
  return undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = parseStatus(searchParams.get("status"));
  if (status === undefined && searchParams.get("status")) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }
  const loan_id = searchParams.get("loan_id") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const items = listDisbursements({
    status: status ?? "all",
    loan_id,
    search,
  });
  const kpis = getDisbursementKpis();
  const eligible_loans = getEligibleLoansForDisbursement().map((l) => ({
    id: l.id,
    loan_number: l.loan_number,
    customer_id: l.customer_id,
    principal_amount: l.principal_amount,
    remaining: getRemainingPrincipalBucket(l),
  }));

  return NextResponse.json({ disbursements: items, kpis, eligible_loans });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<DisbursementCreateInput> & {
    prepared_by?: string;
  };

  if (
    !body.loan_id ||
    typeof body.amount !== "number" ||
    !body.method ||
    !CHANNELS.includes(body.method)
  ) {
    return NextResponse.json(
      { error: "loan_id, amount (number), and valid method are required" },
      { status: 400 }
    );
  }

  const input: DisbursementCreateInput = {
    loan_id: body.loan_id,
    amount: body.amount,
    method: body.method,
    account_name: body.account_name ?? null,
    account_number: body.account_number ?? null,
    bank_name: body.bank_name ?? null,
    transaction_reference: body.transaction_reference ?? null,
    notes: body.notes ?? null,
  };

  const preparedBy = body.prepared_by ?? currentUser.id;
  const result = createDisbursement(input, preparedBy);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ disbursement: result.disbursement });
}
