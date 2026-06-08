"use client";

import { installFetchCachePatch } from "@/lib/client-fetch-cache";

if (typeof window !== "undefined") {
 installFetchCachePatch();
}

/** Ensures the fetch cache module is loaded on the client (patch runs at import time). */
export function FetchCacheProvider() {
 return null;
}
