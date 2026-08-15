import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/** Shared staggered entrance for paginated list rows (customers, leads, loans, applications). */
export function listRowRevealClassName(extra?: string): string {
  return cn(
    "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-300",
    extra
  );
}

export function listRowRevealStyle(index: number): { animationDelay: string } {
  return { animationDelay: `${Math.min(index, 12) * 45}ms` };
}

/** Bump after a list load so rows remount and replay the entrance animation. */
export function useListRevealKey(): [number, () => void] {
  const [key, setKey] = useState(0);
  const bump = useCallback(() => setKey((k) => k + 1), []);
  return [key, bump];
}
