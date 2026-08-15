"use client";

import type { LucideIcon } from "lucide-react";
import { Box, ChartColumnIncreasing, Handbag, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatisticItem = {
  title: string;
  subtitle: string;
  cardIcon: LucideIcon;
  badgeColor: string;
  statusValue: string;
  hint?: string;
};

const defaultItems: StatisticItem[] = [
  {
    title: "Orders",
    subtitle: "5868",
    cardIcon: Handbag,
    badgeColor: "bg-teal-400/10",
    statusValue: "+18%",
  },
  {
    title: "Sales",
    subtitle: "$96,850",
    cardIcon: Box,
    badgeColor: "bg-orange-400/10",
    statusValue: "-5%",
  },
  {
    title: "Profit",
    subtitle: "$82,906",
    cardIcon: ChartColumnIncreasing,
    badgeColor: "bg-teal-400/10",
    statusValue: "+18%",
  },
  {
    title: "Expense",
    subtitle: "$14,653",
    cardIcon: Star,
    badgeColor: "bg-teal-400/10",
    statusValue: "+18%",
  },
];

type StatisticProps = {
  items?: StatisticItem[];
  /** Skip page chrome when embedding inside an existing layout. */
  embedded?: boolean;
};

export default function Statistic({ items, embedded = false }: StatisticProps) {
  const rows = items ?? defaultItems;

  const card = (
    <Card className="p-0! shadow-xs">
      <CardContent className="flex w-full flex-wrap items-center px-0! lg:flex-nowrap">
        {rows.map((item, index) => (
          <div
            className="w-full border-b border-border last:border-b-0 md:w-6/12 md:border-e md:even:border-e-0 md:nth-[n+3]:border-b-0 lg:w-3/12 lg:border-b-0 lg:even:border-e lg:last:border-e-0"
            key={`${item.title}-${index}`}
          >
            <div className="flex items-start justify-between p-6">
              <div className="flex flex-col gap-4">
                <p className="text-base font-medium text-card-foreground">{item.title}</p>
                <div>
                  <p className="text-2xl font-medium text-card-foreground">{item.subtitle}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{item.hint ?? "Last 7 days"}</p>
                    <Badge
                      className={cn("font-normal text-muted-foreground", item.badgeColor)}
                    >
                      {item.statusValue}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="rounded-full p-3 outline">
                <item.cardIcon size={16} />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (embedded) return card;

  return (
    <div className="py-8 sm:py-16 lg:py-20">
      <div className="mx-auto w-full max-w-7xl px-4">{card}</div>
    </div>
  );
}
