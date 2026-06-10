import {
  adaptApiApplicationListRow,
  extractApplicationDetail,
  type ApplicationViewRow,
} from "@/lib/application-adapters";
import {
  getCachedApplicationDetail,
  setCachedApplicationDetail,
} from "@/lib/application-detail-cache";

const BATCH_SIZE = 3;

function mediaScore(app: ApplicationViewRow): number {
  let score = 0;
  for (const col of app.collaterals ?? []) {
    if (col.image_url) score += 2;
    if (col.image_preview_url) score += 1;
  }
  for (const g of app.guarantors ?? []) {
    for (const u of [
      g.id_front_url,
      g.id_back_url,
      g.id_front_preview_url,
      g.id_back_preview_url,
      g.document_url,
    ]) {
      if (u?.trim()) score += 1;
    }
  }
  for (const d of app.documents ?? []) {
    if (d.url?.trim()) score += 2;
    if (d.preview_url?.trim()) score += 1;
  }
  return score;
}

function mergeApplicationMedia(
  base: ApplicationViewRow,
  detail: ApplicationViewRow
): ApplicationViewRow {
  const merged: ApplicationViewRow = { ...base };
  if ((detail.collaterals?.length ?? 0) > 0) merged.collaterals = detail.collaterals;
  if ((detail.guarantors?.length ?? 0) > 0) merged.guarantors = detail.guarantors;
  if ((detail.documents?.length ?? 0) > 0) merged.documents = detail.documents;
  return mediaScore(merged) >= mediaScore(base) ? merged : base;
}

async function fetchApplicationDetailRow(id: string): Promise<ApplicationViewRow | null> {
  try {
    const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const detail = extractApplicationDetail(json);
    if (!detail) return null;
    const row = adaptApiApplicationListRow({ application: detail });
    if (mediaScore(row) > 0) {
      setCachedApplicationDetail(id, row);
    }
    return row;
  } catch {
    return null;
  }
}

async function enrichOne(app: ApplicationViewRow): Promise<ApplicationViewRow> {
  const cached = getCachedApplicationDetail(app.id);
  let best = cached ? mergeApplicationMedia(app, cached) : app;

  if (mediaScore(best) > 0) return best;

  const detail = await fetchApplicationDetailRow(app.id);
  if (detail) {
    best = mergeApplicationMedia(best, detail);
  }
  return best;
}

/** Load collateral/guarantor/document URLs from application detail (list rows are often summary-only). */
export async function enrichCustomerApplicationsForMedia(
  applications: ApplicationViewRow[]
): Promise<ApplicationViewRow[]> {
  if (applications.length === 0) return [];

  const results = [...applications];

  for (let i = 0; i < applications.length; i += BATCH_SIZE) {
    const batch = applications.slice(i, i + BATCH_SIZE);
    const detailed = await Promise.all(batch.map((app) => enrichOne(app)));
    for (let j = 0; j < detailed.length; j += 1) {
      results[i + j] = detailed[j];
    }
  }

  return results;
}
