"use client";

import { usePathname } from "next/navigation";
import {
 type MouseEvent,
 type ReactNode,
 useCallback,
 useEffect,
 useMemo,
 useRef,
 useState,
} from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { NavigationTransitionContext } from "@/components/navigation-transition-context";
import { SidebarInset } from "@/components/ui/sidebar";
import { StatusLoader } from "@/components/ui/status-loader";

function pathOnly(href: string): string {
 try {
 return new URL(href, "http://local").pathname;
 } catch {
 return href.split("?")[0] || href;
 }
}

export function DashboardNavigationShell({
 children,
 sidebar,
}: {
 children: ReactNode;
 sidebar?: ReactNode;
}) {
 const pathname = usePathname();
 const [pendingPath, setPendingPath] = useState<string | null>(null);
 const [isNavigating, setIsNavigating] = useState(false);
 const [apiFetches, setApiFetches] = useState(0);
 const pendingPathRef = useRef<string | null>(null);
 const isNavigatingRef = useRef(false);
 const apiFetchesRef = useRef(0);
 const earliestFinishRef = useRef(0);

 const finishIfReady = useCallback(() => {
 if (!isNavigatingRef.current || pendingPathRef.current || apiFetchesRef.current > 0) return;
 const remaining = earliestFinishRef.current - Date.now();
 if (remaining > 0) {
 window.setTimeout(finishIfReady, remaining);
 return;
 }
 isNavigatingRef.current = false;
 setIsNavigating(false);
 }, []);

 useEffect(() => {
 pendingPathRef.current = pendingPath;
 finishIfReady();
 }, [pendingPath, finishIfReady]);

 useEffect(() => {
 isNavigatingRef.current = isNavigating;
 }, [isNavigating]);

 useEffect(() => {
 apiFetchesRef.current = apiFetches;
 finishIfReady();
 }, [apiFetches, finishIfReady]);

 useEffect(() => {
 pendingPathRef.current = null;
 setPendingPath(null);
 finishIfReady();
 }, [pathname, finishIfReady]);

 useEffect(() => {
 const originalFetch = window.fetch;
 window.fetch = async (input, init) => {
 const url =
 typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
 const parsed = new URL(url, window.location.origin);
 const trackFetch =
 isNavigatingRef.current &&
 parsed.origin === window.location.origin &&
 parsed.pathname.startsWith("/api/");

 if (trackFetch) {
 apiFetchesRef.current += 1;
 setApiFetches(apiFetchesRef.current);
 }

 try {
 return await originalFetch(input, init);
 } finally {
 if (trackFetch) {
 apiFetchesRef.current = Math.max(0, apiFetchesRef.current - 1);
 setApiFetches(apiFetchesRef.current);
 finishIfReady();
 }
 }
 };

 return () => {
 window.fetch = originalFetch;
 };
 }, [finishIfReady]);

 useEffect(() => {
 if (!pendingPath) return;
 const timeout = window.setTimeout(() => {
 pendingPathRef.current = null;
 setPendingPath(null);
 finishIfReady();
 }, 8000);
 return () => window.clearTimeout(timeout);
 }, [pendingPath, finishIfReady]);

 useEffect(() => {
 if (!isNavigating) return;
 const timeout = window.setTimeout(() => {
 isNavigatingRef.current = false;
 setIsNavigating(false);
 }, 10000);
 return () => window.clearTimeout(timeout);
 }, [isNavigating]);

 const startNavigation = useCallback(
 (href: string, event?: MouseEvent<HTMLElement>) => {
 if (
 event &&
 (event.defaultPrevented ||
 event.button !== 0 ||
 event.metaKey ||
 event.ctrlKey ||
 event.shiftKey ||
 event.altKey)
 ) {
 return;
 }

 const nextPath = pathOnly(href);
 if (nextPath !== pathname) {
 pendingPathRef.current = nextPath;
 earliestFinishRef.current = Date.now() + 700;
 isNavigatingRef.current = true;
 setPendingPath(nextPath);
 setIsNavigating(true);
 }
 },
 [pathname]
 );

 const value = useMemo(
 () => ({
 activePath: pendingPath ?? pathname,
 pendingPath,
 startNavigation,
 }),
 [pathname, pendingPath, startNavigation]
 );

 return (
 <NavigationTransitionContext.Provider value={value}>
 {sidebar ?? <AppSidebar />}
 <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
 <div className="relative flex min-h-0 flex-1 flex-col">
 {children}
 {isNavigating && (
 <div
 className="absolute inset-0 z-50 grid place-items-center bg-background/55 backdrop-blur-[1px]"
 aria-live="polite"
 aria-label="Loading page"
 >
 <div className="rounded-lg border border-border/70 bg-background/90 px-8 py-6 shadow-lg">
 <StatusLoader />
 <p className="mt-3 text-center text-sm font-medium text-muted-foreground">
 Loading page
 </p>
 </div>
 </div>
 )}
 </div>
 </SidebarInset>
 </NavigationTransitionContext.Provider>
 );
}
