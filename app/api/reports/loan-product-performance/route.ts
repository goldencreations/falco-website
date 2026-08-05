import { proxyReportGet } from "@/lib/report-route-proxy";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return proxyReportGet(request, "/reports/loan-product-performance");
}
