import { extractApplicationDetail } from "@/lib/application-adapters";
import { invalidateApplicationDetailCache } from "@/lib/application-detail-cache";
import { debugApplicationCreate } from "@/lib/application-debug";
import { validateDocumentFile } from "@/lib/application-documents";
import { formatClientApiError } from "@/lib/application-workflow";

export type LinkedApplicationIds = {
  applicationId: string;
  collateralIds: string[];
  guarantorIds: string[];
};

export type CollateralFileRow = {
  type: string;
  image: File | null;
};

export type GuarantorFileRow = {
  name: string;
  phone: string;
  idFront: File | null;
  idBack: File | null;
  photo: File | null;
  photoWithCustomer: File | null;
  wardLetter: File | null;
  attachments: File[];
};

function readId(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function idsFromApplicationObject(app: Record<string, unknown>): LinkedApplicationIds | null {
  const applicationId = readId(app.id);
  if (!applicationId) return null;

  const collateralIds = (Array.isArray(app.collaterals) ? app.collaterals : [])
    .map((c) => (c && typeof c === "object" ? readId((c as Record<string, unknown>).id) : null))
    .filter((id): id is string => Boolean(id));

  const guarantorIds = (Array.isArray(app.guarantors) ? app.guarantors : [])
    .map((g) => (g && typeof g === "object" ? readId((g as Record<string, unknown>).id) : null))
    .filter((id): id is string => Boolean(id));

  return { applicationId, collateralIds, guarantorIds };
}

/** Read collateral/guarantor IDs from POST/PATCH or GET application responses. */
export function extractLinkedApplicationIds(json: unknown): LinkedApplicationIds | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const nested =
    o.application && typeof o.application === "object"
      ? (o.application as Record<string, unknown>)
      : null;
  if (nested) {
    const fromNested = idsFromApplicationObject(nested);
    if (fromNested) return fromNested;
  }
  return idsFromApplicationObject(o);
}

export function linkedIdsNeedRefresh(
  linked: LinkedApplicationIds,
  collaterals: CollateralFileRow[],
  guarantors: GuarantorFileRow[]
): boolean {
  const collateralRows = collaterals.filter((c) => c.type.trim());
  const guarantorRows = guarantors.filter((g) => g.name.trim() && g.phone.trim());
  return (
    collateralRows.length > linked.collateralIds.length ||
    guarantorRows.length > linked.guarantorIds.length
  );
}

export async function fetchLinkedApplicationIds(
  applicationId: string
): Promise<LinkedApplicationIds | null> {
  const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const detail = extractApplicationDetail(json);
  if (!detail) return extractLinkedApplicationIds(json);
  return idsFromApplicationObject(detail);
}

async function uploadLinkedFile(
  url: string,
  file: File,
  label: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateDocumentFile(file);
  if (!validated.ok) return validated;

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("name", file.name);

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: formatClientApiError(data, `${label} upload failed (${res.status})`) };
  }
  return { ok: true };
}

type PendingUpload = {
  label: string;
  run: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * Upload collateral images and guarantor ID scans after the application JSON is saved.
 * Files upload in parallel; matched to backend IDs by index among non-empty rows.
 */
export async function uploadCollateralAndGuarantorFiles(
  applicationId: string,
  linked: LinkedApplicationIds,
  collaterals: CollateralFileRow[],
  guarantors: GuarantorFileRow[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const collateralRows = collaterals.filter((c) => c.type.trim());
  const guarantorRows = guarantors.filter((g) => g.name.trim() && g.phone.trim());

  if (linkedIdsNeedRefresh(linked, collaterals, guarantors)) {
    debugApplicationCreate("linked uploads — refreshing IDs");
    const refreshed = await fetchLinkedApplicationIds(applicationId);
    if (refreshed) linked = refreshed;
  }

  const pending: PendingUpload[] = [];

  for (let i = 0; i < collateralRows.length; i++) {
    const file = collateralRows[i].image;
    if (!file) continue;
    const collateralId = linked.collateralIds[i];
    if (!collateralId) {
      return {
        ok: false,
        error: `Collateral image could not be uploaded — missing collateral ID for row ${i + 1}. Save the application and try again.`,
      };
    }
    const label = `Collateral ${collateralRows[i].type}`;
    const url = `/api/applications/${encodeURIComponent(applicationId)}/collaterals/${encodeURIComponent(collateralId)}/image`;
    pending.push({
      label,
      run: () => uploadLinkedFile(url, file, label),
    });
  }

  for (let i = 0; i < guarantorRows.length; i++) {
    const guarantorId = linked.guarantorIds[i];
    const row = guarantorRows[i];
    const needsFile = Boolean(
      row.idFront ||
        row.idBack ||
        row.photo ||
        row.photoWithCustomer ||
        row.wardLetter ||
        row.attachments.length > 0
    );
    if (!guarantorId) {
      if (needsFile) {
        return {
          ok: false,
          error: `Guarantor documents could not be uploaded — missing guarantor ID for ${row.name}. Save the application and try again.`,
        };
      }
      continue;
    }

    const base = `/api/applications/${encodeURIComponent(applicationId)}/guarantors/${encodeURIComponent(guarantorId)}`;

    if (row.idFront) {
      const label = `${row.name} ID front`;
      pending.push({
        label,
        run: () => uploadLinkedFile(`${base}/id-front`, row.idFront!, label),
      });
    }

    if (row.idBack) {
      const label = `${row.name} ID back`;
      pending.push({
        label,
        run: () => uploadLinkedFile(`${base}/id-back`, row.idBack!, label),
      });
    }

    if (row.photo) {
      const label = `${row.name} photo`;
      pending.push({
        label,
        run: () => uploadLinkedFile(`${base}/photo`, row.photo!, label),
      });
    }

    if (row.photoWithCustomer) {
      const label = `${row.name} photo with customer`;
      pending.push({
        label,
        run: () => uploadLinkedFile(`${base}/photo-with-customer`, row.photoWithCustomer!, label),
      });
    }

    if (row.wardLetter) {
      const label = `${row.name} ward letter`;
      pending.push({
        label,
        run: () => uploadLinkedFile(`${base}/ward-letter`, row.wardLetter!, label),
      });
    }

    for (let j = 0; j < row.attachments.length; j++) {
      const file = row.attachments[j];
      const label = `${row.name} attachment ${j + 1}`;
      pending.push({
        label,
        run: () => uploadLinkedFile(`${base}/attachments`, file, label),
      });
    }
  }

  if (pending.length === 0) return { ok: true };

  debugApplicationCreate("linked uploads — parallel batch", {
    applicationId,
    count: pending.length,
    labels: pending.map((p) => p.label),
  });

  const results = await Promise.all(pending.map((p) => p.run()));
  const failed = results.find((r) => !r.ok);
  if (failed && !failed.ok) return failed;

  invalidateApplicationDetailCache(applicationId);
  return { ok: true };
}
