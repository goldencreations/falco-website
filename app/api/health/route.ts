import { NextResponse } from "next/server";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";

/** Quick check that the Next server can reach the configured Falco API. */
export async function GET() {
 const base = getFalcoApiBaseUrl();
 const started = Date.now();
 try {
 const res = await fetch(`${base}/api/login`, {
 method: "POST",
 headers: {
 Accept: "application/json",
 "Content-Type": "application/json",
 "User-Agent": "FalcoWebsite/1.0 (health)",
 },
 body: JSON.stringify({ email: "health@probe.local", password: "probe-only" }),
 cache: "no-store",
 });
 const latencyMs = Date.now() - started;
 return NextResponse.json({
 ok: true,
 api_base_url: base,
 api_reachable: true,
 api_status: res.status,
 latency_ms: latencyMs,
 hint:
 res.status === 422
 ? "API is online (validation response is expected for probe login)."
 : "API responded.",
 });
 } catch (e) {
 const message = e instanceof Error ? e.message : "Network error";
 return NextResponse.json(
 {
 ok: false,
 api_base_url: base,
 api_reachable: false,
 message: `Cannot reach Falco API: ${message}`,
 },
 { status: 503 }
 );
 }
}
