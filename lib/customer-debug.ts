const PREFIX = "[customers]";

function log(scope: "detail", step: string, data?: unknown) {
  if (data !== undefined) {
    console.log(`${PREFIX} [${scope}] ${step}`, data);
  } else {
    console.log(`${PREFIX} [${scope}] ${step}`);
  }
}

export function debugCustomerDetail(step: string, data?: unknown) {
  log("detail", step, data);
}

/** Safe summary for `GET /customers/{id}` rows — avoids dumping full nested payloads. */
export function summarizeCustomerDetailRow(row: Record<string, unknown>) {
  const md =
    row.metadata && typeof row.metadata === "object" && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};

  const collaterals = Array.isArray(row.collateral)
    ? row.collateral
    : Array.isArray(row.collaterals)
      ? row.collaterals
      : Array.isArray(md.collateral)
        ? md.collateral
        : Array.isArray(md.collaterals)
          ? md.collaterals
          : [];

  const guarantors = Array.isArray(row.guarantors)
    ? row.guarantors
    : Array.isArray(md.guarantors)
      ? md.guarantors
      : [];

  return {
    id: row.id,
    customer_number: row.customer_number,
    full_name: row.full_name,
    branch_id: row.branch_id,
    collaterals_count: collaterals.length,
    collaterals_with_image: collaterals.filter((c) => {
      if (!c || typeof c !== "object") return false;
      const o = c as Record<string, unknown>;
      return Boolean(
        o.image_document ||
          o.image_url ||
          o.image_preview_url ||
          o.image_document_id
      );
    }).length,
    guarantors_count: guarantors.length,
    guarantors_with_id_front: guarantors.filter((g) => {
      if (!g || typeof g !== "object") return false;
      const o = g as Record<string, unknown>;
      return Boolean(o.id_front_document || o.id_front_url || o.id_front_preview_url);
    }).length,
    guarantors_with_id_back: guarantors.filter((g) => {
      if (!g || typeof g !== "object") return false;
      const o = g as Record<string, unknown>;
      return Boolean(o.id_back_document || o.id_back_url || o.id_back_preview_url);
    }).length,
    has_passport_photo: Boolean(row.passport_photo || row.passport_photo_url),
  };
}
