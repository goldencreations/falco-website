"use client";

import { useEffect } from "react";

const RELOAD_KEY = "falco.chunk-reload";

function isChunkLoadFailure(message: string): boolean {
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed")
  );
}

/**
 * After a Netlify deploy, cached HTML can reference new JS chunks while the browser
 * still has old bundles — that throws on first load. Reload once to recover.
 */
export function ClientChunkRecovery() {
  useEffect(() => {
    const tryReload = (message: string) => {
      if (!isChunkLoadFailure(message)) return;
      if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      tryReload(event.message || String(event.error ?? ""));
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? reason.message
            : String(reason ?? "");
      tryReload(message);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
