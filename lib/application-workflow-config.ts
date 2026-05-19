/** When true, missing file uploads do not block submit/activation (metadata placeholders may be used). */
export const APPLICATION_DOCUMENTS_OPTIONAL = true;

/** When true, non-draft creates run the full approve → loan workflow after save. */
export const APPLICATION_AUTO_ACTIVATE = true;

/**
 * When true, after final approval the app runs a cash disbursement so the loan status
 * becomes `active` (per disbursements-controller.md). Requires `APPLICATION_AUTO_ACTIVATE`.
 * Keep false so loans stay `pending_disbursement` until released via Loan Disbursement.
 */
export const APPLICATION_AUTO_DISBURSE_CASH = false;
