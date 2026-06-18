"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  Search,
  User,
  Users,
  Wallet,
  ClipboardList,
  UserPlus,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  GLOBAL_SEARCH_KIND_LABEL,
  type GlobalSearchResult,
  type GlobalSearchResultKind,
} from "@/lib/global-search";
import { resolvePortalPath } from "@/lib/portal-paths";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<GlobalSearchResultKind, typeof User> = {
  customer: User,
  loan: Wallet,
  application: FileText,
  staff: Users,
  lead: UserPlus,
  group: Users,
  payment: ClipboardList,
};

function groupResults(results: GlobalSearchResult[]) {
  const groups = new Map<GlobalSearchResultKind, GlobalSearchResult[]>();
  for (const result of results) {
    const list = groups.get(result.kind) ?? [];
    list.push(result);
    groups.set(result.kind, list);
  }
  return groups;
}

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { user } = useSessionUser();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const grouped = useMemo(() => groupResults(results), [results]);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as { results?: GlobalSearchResult[]; message?: string };
      if (!res.ok) {
        setResults([]);
        setError(json.message ?? "Search failed");
        return;
      }
      setResults(json.results ?? []);
    } catch {
      setResults([]);
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [open, query, runSearch]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigateTo = (result: GlobalSearchResult) => {
    const href = resolvePortalPath(user?.role, result.path);
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  };

  return (
    <>
      <div
        className={cn("relative", className)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Open global search"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          readOnly
          placeholder="Search customers, loans, officers…"
          className="w-64 cursor-pointer pl-9 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-primary"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-background px-1.5 text-[10px] font-medium text-muted-foreground lg:inline">
          Ctrl K
        </kbd>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Falco"
        description="Search customers, loans, applications, staff, and more"
        className="sm:max-w-xl"
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Name, loan number, application code, officer…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : null}
          {!loading && query.trim().length < 2 ? (
            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
          ) : null}
          {!loading && query.trim().length >= 2 && results.length === 0 ? (
            <CommandEmpty>{error || "No matches found."}</CommandEmpty>
          ) : null}
          {!loading
            ? Array.from(grouped.entries()).map(([kind, items], index) => {
                const Icon = KIND_ICON[kind];
                return (
                  <div key={kind}>
                    {index > 0 ? <CommandSeparator /> : null}
                    <CommandGroup heading={GLOBAL_SEARCH_KIND_LABEL[kind]}>
                      {items.map((result) => (
                        <CommandItem
                          key={`${result.kind}-${result.id}`}
                          value={`${result.kind}-${result.id}-${result.title}-${result.subtitle ?? ""}`}
                          onSelect={() => navigateTo(result)}
                        >
                          <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{result.title}</p>
                            {result.subtitle ? (
                              <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>
                            ) : null}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </div>
                );
              })
            : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
