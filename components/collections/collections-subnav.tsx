"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";

function resolveCollectionsBase(pathname: string): string {
  if (pathname.startsWith("/accountant/collections")) return "/accountant/collections";
  if (pathname.startsWith("/manager/collections")) return "/manager/collections";
  return "/collections";
}

export function CollectionsSubnav() {
  const pathname = usePathname();
  const { t } = useTranslations();
  const base = resolveCollectionsBase(pathname);

  const items = [
    {
      href: `${base}/activities`,
      label: t("collections.activitiesTab"),
      icon: Activity,
    },
    {
      href: `${base}/queue`,
      label: t("collections.queueTab"),
      icon: AlertTriangle,
    },
    {
      href: `${base}/vikundi`,
      label: t("collections.vikundiTab"),
      icon: Users,
    },
  ];

  return (
    <nav className="flex flex-wrap gap-2 rounded-xl border bg-card p-1.5 shadow-sm">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
