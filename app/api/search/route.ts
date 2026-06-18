import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { runGlobalSearch } from "@/lib/global-search-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [], query: q });
  }

  const results = await runGlobalSearch(auth.user, q, request);
  return NextResponse.json({ results, query: q });
}
