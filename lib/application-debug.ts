const PREFIX = "[applications]";

function log(scope: "create" | "detail", step: string, data?: unknown) {
  if (data !== undefined) {
    console.log(`${PREFIX} [${scope}] ${step}`, data);
  } else {
    console.log(`${PREFIX} [${scope}] ${step}`);
  }
}

export function debugApplicationCreate(step: string, data?: unknown) {
  log("create", step, data);
}

export function debugApplicationDetail(step: string, data?: unknown) {
  log("detail", step, data);
}

/** Safe summary for request bodies — avoids dumping full nested payloads. */
export function summarizeApplicationBody(body: Record<string, unknown>) {
  return {
    customer_id: body.customer_id,
    product_id: body.product_id,
    loan_mode: body.loan_mode,
    group_id: body.group_id,
    requested_amount: body.requested_amount,
    term_days: body.term_days,
    purpose: typeof body.purpose === "string" ? body.purpose.slice(0, 80) : body.purpose,
    repayment_frequency: body.repayment_frequency,
    collaterals_count: Array.isArray(body.collaterals) ? body.collaterals.length : 0,
    guarantors_count: Array.isArray(body.guarantors) ? body.guarantors.length : 0,
    references_count: Array.isArray(body.references) ? body.references.length : 0,
    has_location: Boolean(body.location),
  };
}

/** Safe summary for API application detail rows. */
export function summarizeApplicationDetailRow(row: Record<string, unknown>) {
  const documents = Array.isArray(row.documents) ? row.documents : [];
  const collaterals = Array.isArray(row.collaterals) ? row.collaterals : [];
  const guarantors = Array.isArray(row.guarantors) ? row.guarantors : [];

  return {
    id: row.id,
    application_number: row.application_number,
    status: row.status,
    workflow_stage: row.workflow_stage,
    customer_id: row.customer_id,
    product_id: row.product_id,
    branch_id: row.branch_id,
    requested_amount: row.requested_amount,
    approved_amount: row.approved_amount,
    collaterals_count: collaterals.length,
    collaterals_with_image: collaterals.filter((c) => {
      if (!c || typeof c !== "object") return false;
      const o = c as Record<string, unknown>;
      return Boolean(o.image_document || o.image_url || o.image_preview_url);
    }).length,
    guarantors_count: guarantors.length,
    documents_count: documents.length,
    documents_with_url: documents.filter((d) => {
      if (!d || typeof d !== "object") return false;
      const url = (d as Record<string, unknown>).url;
      return typeof url === "string" && url.trim().length > 0;
    }).length,
  };
}
