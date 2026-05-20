import { NextResponse } from "next/server";

import { requireApiUser, ensurePathBranchIdAllowed } from "@/lib/authorization";
import { extractSingleBranch } from "@/lib/branch-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `PATCH /branches/{branch}/manager`. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 if (!id) {
 return NextResponse.json({ message: "Branch id is required" }, { status: 400 });
 }

 const denied = ensurePathBranchIdAllowed(auth.user, id);
 if (denied) return denied;

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
 }

 const managerId = body.manager_id;
 const payload: Record<string, unknown> = {};
 if (managerId === null || managerId === "" || managerId === undefined) {
 payload.manager_id = null;
 } else {
 payload.manager_id = String(managerId);
 }

 const res = await falcoServerFetch<unknown>(
 `/branches/${encodeURIComponent(id)}/manager`,
 { method: "PATCH", body: payload }
 );

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const branch = extractSingleBranch(res.data);
 if (!branch) {
 return NextResponse.json({ message: "Unexpected manager assignment response" }, { status: 502 });
 }

 return NextResponse.json({ branch });
}
