import { rolePortalBase } from "@/lib/role-portal";
import type { UserRole } from "@/lib/types";

function normalizeSegment(segment: string): string {
 return segment.startsWith("/") ? segment : `/${segment}`;
}

/** Build a role-aware app path (e.g. `/officer/credit-analysis` for loan officers). */
export function resolvePortalPath(role: UserRole | undefined | null, segment: string): string {
 const path = normalizeSegment(segment);
 const base = rolePortalBase(role);
 if (!base) return path;
 if (path === base || path.startsWith(`${base}/`)) return path;
 return `${base}${path}`;
}

/** Alias used by Vikundi / groups screens. */
export const resolvePortalHref = resolvePortalPath;

/** Infer portal base from the current URL (for shared pages mounted under multiple layouts). */
export function resolvePortalPathFromPathname(pathname: string, segment: string): string {
 const path = normalizeSegment(segment);
 const base = pathname.startsWith("/officer")
 ? "/officer"
 : pathname.startsWith("/manager")
 ? "/manager"
 : pathname.startsWith("/accountant")
 ? "/accountant"
 : "";
 if (!base) return path;
 if (path === base || path.startsWith(`${base}/`)) return path;
 return `${base}${path}`;
}
