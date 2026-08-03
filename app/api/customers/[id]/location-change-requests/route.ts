import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

/**
 * Direct lat/lng edits on an existing customer are restricted by the backend — location
 * changes must go through `POST /customers/{customerId}/location-change-requests` and are
 * applied only after manager/admin review (see `PATCH /customer-location-change-requests/{id}`).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "Customer id is required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { message: "latitude and longitude are required" },
      { status: 422 }
    );
  }

  const payload: Record<string, unknown> = {
    latitude,
    longitude,
    location_name: body.location_name != null ? String(body.location_name).trim() : undefined,
    location_captured_at:
      body.location_captured_at != null
        ? String(body.location_captured_at)
        : new Date().toISOString(),
  };

  const res = await falcoServerFetch<unknown>(
    `/customers/${encodeURIComponent(id)}/location-change-requests`,
    { method: "POST", body: payload, request }
  );

  if (!res.ok) {
    return NextResponse.json(
      { message: res.error.message, details: res.error.details },
      { status: res.error.status }
    );
  }
  return NextResponse.json(res.data ?? { ok: true });
}
