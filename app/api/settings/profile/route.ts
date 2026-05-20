import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { parseProfileResponse } from "@/lib/settings-adapters";
import type { SessionUserClient } from "@/lib/use-session-user";
import { falcoServerFetch } from "@/lib/server-falco";

function sessionUserToClient(user: {
 id: string;
 email: string;
 full_name: string;
 role: SessionUserClient["role"];
 branch_id: string;
 permissions?: string[];
}): SessionUserClient {
 return {
 id: user.id,
 email: user.email,
 full_name: user.full_name,
 role: user.role,
 branch_id: user.branch_id,
 permissions: user.permissions,
 is_active: true,
 };
}

/** Proxies `GET /settings/profile`. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const res = await falcoServerFetch<unknown>("/settings/profile", { request });
 if (!res.ok) {
 const fallbackUser = sessionUserToClient(auth.user);
 return NextResponse.json({
 user: fallbackUser,
 preferences: parseProfileResponse(null).preferences,
 message: res.error.message,
 partial: true,
 });
 }

 const parsed = parseProfileResponse(res.data);
 return NextResponse.json({
 user: parsed.user ?? sessionUserToClient(auth.user),
 preferences: parsed.preferences,
 });
}
