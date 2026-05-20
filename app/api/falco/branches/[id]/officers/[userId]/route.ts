import { NextResponse } from "next/server";

import { requireApiUser, ensurePathBranchIdAllowed } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `DELETE /branches/{branch}/officers/{user}`. */
export async function DELETE(
 request: Request,
 context: { params: Promise<{ id: string; userId: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id, userId } = await context.params;
 if (!id || !userId) {
 return NextResponse.json({ message: "Branch id and user id are required" }, { status: 400 });
 }

 const denied = ensurePathBranchIdAllowed(auth.user, id);
 if (denied) return denied;

 const res = await falcoServerFetch<unknown>(
 `/branches/${encodeURIComponent(id)}/officers/${encodeURIComponent(userId)}`,
 { method: "DELETE" }
 );

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data ?? { ok: true });
}
