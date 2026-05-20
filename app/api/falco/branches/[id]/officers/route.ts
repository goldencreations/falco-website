import { NextResponse } from "next/server";

import { requireApiUser, ensurePathBranchIdAllowed } from "@/lib/authorization";
import { adaptApiUserToUser } from "@/lib/user-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `POST /branches/{branch}/officers`. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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

 const userId = body.user_id ?? body.officer_id ?? body.id;
 if (!userId) {
 return NextResponse.json({ message: "user_id is required" }, { status: 400 });
 }

 const res = await falcoServerFetch<{ user?: Record<string, unknown> }>(
 `/branches/${encodeURIComponent(id)}/officers`,
 { method: "POST", body: { user_id: String(userId) } }
 );

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const row = (res.data as { user?: Record<string, unknown> }).user;
 if (row) {
 return NextResponse.json({ user: adaptApiUserToUser(row) });
 }

 return NextResponse.json(res.data ?? { ok: true });
}
