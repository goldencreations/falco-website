export type WorkflowLoanRef = {
 id: string;
 status?: string;
 principal?: number;
};

export function extractLoanFromWorkflowResponse(json: unknown): WorkflowLoanRef | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;

 const loan =
 o.loan && typeof o.loan === "object" ? (o.loan as Record<string, unknown>) : null;
 if (loan?.id != null) {
 return {
 id: String(loan.id),
 status: loan.status != null ? String(loan.status) : undefined,
 principal: readPrincipal(loan),
 };
 }

 const app =
 o.application && typeof o.application === "object"
 ? (o.application as Record<string, unknown>)
 : null;
 if (app) {
 const nested =
 app.loan && typeof app.loan === "object" ? (app.loan as Record<string, unknown>) : null;
 if (nested?.id != null) {
 return {
 id: String(nested.id),
 status: nested.status != null ? String(nested.status) : undefined,
 principal: readPrincipal(nested),
 };
 }
 if (app.loan_id != null) {
 return { id: String(app.loan_id) };
 }
 }

 return null;
}

function readPrincipal(row: Record<string, unknown>): number | undefined {
 const v = row.principal ?? row.principal_amount ?? row.disbursed_principal;
 if (v == null || v === "") return undefined;
 const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
 return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Cash disbursement activates the loan (`POST /loans/{id}/disburse`, channel `cash`). */
export async function disburseLoanCashApi(
 loanId: string,
 disbursedAmount: number
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
 const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/disburse`, {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 disbursement_date: new Date().toISOString().slice(0, 10),
 disbursed_amount: disbursedAmount,
 disbursement_channel: "cash",
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 const message =
 data && typeof data === "object" && typeof (data as Record<string, unknown>).message === "string"
 ? String((data as Record<string, unknown>).message)
 : `Cash disbursement failed (${res.status})`;
 return { ok: false, error: message };
 }
 return { ok: true, data };
}
